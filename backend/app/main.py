import io
import json
import time
import sqlite3
import asyncio
import urllib.request
import urllib.error
from typing import Dict, List, Any, Optional

from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    UploadFile,
    File,
    Form,
    Depends,
    HTTPException,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field

from app.db import get_db, init_db, DB_PATH
from app.seed import seed_database, ensure_user_profile
from app.engine.pathfinder import (
    build_nx_graph,
    compute_centrality_metrics,
    calculate_warm_paths,
    generate_outreach_blurbs,
)
from app.ingest.linkedin_zip import LinkedInArchiveParser, classify_contact_attributes
from app.ingest.resume_parser import ingest_resume_into_db
from app.engine.recalculations import registry

# Initialize WAL SQLite schema & one-time migrations on startup
init_db()

app = FastAPI(
    title="Career Network Optimizer Engine",
    description="Local-first SQLite WAL + NetworkX relational-graph hybrid engine for warm pathfinding & Expected Career Value (EV)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class SkillPayload(BaseModel):
    name: Optional[str] = None
    skill_name: Optional[str] = None
    category: str = "Systems"
    proficiency: int = Field(default=88, ge=1, le=100)


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    headline: Optional[str] = None
    current_company: Optional[str] = None
    currentCompany: Optional[str] = None
    location: Optional[str] = None
    active_goal_mode: Optional[str] = None
    activeGoalMode: Optional[str] = None
    active_career_vector: Optional[str] = None
    activeCareerVector: Optional[str] = None
    repositories: Optional[List[str]] = None
    target_roles: Optional[List[str]] = None
    target_companies: Optional[List[str]] = None
    targetCompanies: Optional[List[str]] = None
    skills: Optional[List[SkillPayload]] = None


class NodeCreate(BaseModel):
    id: Optional[str] = None
    user_id: str = "default_user"
    full_name: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = ""
    company: Optional[str] = ""
    location: Optional[str] = "Bay Area, CA"
    degree: int = Field(default=1, ge=0, le=3)
    trust_score: Optional[float] = None
    trustScore: Optional[float] = None
    strategic_value: Optional[int] = None
    strategicValue: Optional[int] = None
    authority_level: Optional[str] = None
    authorityLevel: Optional[str] = None
    cluster: Optional[str] = None
    skills: List[str] = []
    past_role_3yrs_ago: Optional[str] = ""
    knn_similarity: Optional[int] = 0
    vector_cluster: Optional[str] = ""
    github_overlap: Optional[str] = ""
    githubOverlap: Optional[str] = None
    linkedin_url: Optional[str] = ""
    connected_on: Optional[str] = ""
    message_count: int = 0
    bridge_id: Optional[str] = None
    bridge_weight: Optional[float] = None
    notes: Optional[str] = ""


class NodePatch(BaseModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    degree: Optional[int] = None
    trust_score: Optional[float] = None
    trustScore: Optional[float] = None
    strategic_value: Optional[int] = None
    strategicValue: Optional[int] = None
    authority_level: Optional[str] = None
    authorityLevel: Optional[str] = None
    cluster: Optional[str] = None
    skills: Optional[List[str]] = None
    past_role_3yrs_ago: Optional[str] = None
    knn_similarity: Optional[int] = None
    github_overlap: Optional[str] = None
    githubOverlap: Optional[str] = None
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None


class EdgeCreate(BaseModel):
    user_id: str = "default_user"
    source_id: Optional[str] = None
    source: Optional[str] = None
    target_id: Optional[str] = None
    target: Optional[str] = None
    weight: float = Field(default=0.75, ge=0.05, le=1.0)
    relationship_type: str = "direct"
    context: Optional[str] = ""


class FullStateSyncPayload(BaseModel):
    profile: Dict[str, Any]
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


class ProcessorRunRequest(BaseModel):
    user_id: str = "default_user"
    processor_id: str
    params: Optional[Dict[str, Any]] = None


class PipelineRunRequest(BaseModel):
    user_id: str = "default_user"
    processors: Optional[List[str]] = None
    params_map: Optional[Dict[str, Dict[str, Any]]] = None


# ============================================================================
# WEBSOCKET MANAGER & STATE SERIALIZER
# ============================================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)


ws_manager = ConnectionManager()


def _normalize_endpoint_id(raw_id: str, user_id: str) -> str:
    if raw_id in ("user-root", user_id):
        return f"{user_id}_root"
    return raw_id


def serialize_full_state(conn: sqlite3.Connection, user_id: str) -> Dict[str, Any]:
    """Serializes the canonical SQLite database state into the unified frontend + API schema."""
    ensure_user_profile(conn, user_id)
    root_id = f"{user_id}_root"

    user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    skills_rows = conn.execute(
        "SELECT skill_name, category, proficiency FROM user_skills WHERE user_id = ? ORDER BY proficiency DESC",
        (user_id,),
    ).fetchall()

    repos = json.loads(user_row["repositories_json"] or "[]")
    target_companies = json.loads(user_row["target_companies_json"] or "[]")
    target_roles = json.loads(user_row["target_roles_json"] or "[]")

    profile_out = {
        "id": "user-root",
        "user_id": user_id,
        "name": user_row["full_name"],
        "full_name": user_row["full_name"],
        "headline": user_row["headline"] or "",
        "currentCompany": user_row["current_company"] or "Tesla",
        "current_company": user_row["current_company"] or "Tesla",
        "location": user_row["location"] or "San Jose, CA",
        "activeGoalMode": user_row["active_goal_mode"] or "trajectory",
        "activeCareerVector": user_row["active_career_vector"] or "Principal Embodied AI & Humanoid Data Architect",
        "repositories": repos,
        "targetCompanies": target_companies,
        "target_companies": target_companies,
        "target_roles": target_roles,
        "skills": [
            {
                "name": r["skill_name"],
                "skill_name": r["skill_name"],
                "category": r["category"] or "Systems",
                "proficiency": int(r["proficiency"] or 85),
            }
            for r in skills_rows
        ],
    }

    node_rows = conn.execute(
        "SELECT * FROM nodes WHERE user_id = ? AND degree >= 1 ORDER BY strategic_value DESC, trust_score DESC",
        (user_id,),
    ).fetchall()

    nodes_out = []
    for n in node_rows:
        try:
            sk = json.loads(n["skills_json"] or "[]")
        except Exception:
            sk = []
        past_role = n["past_role_3yrs_ago"] or ""
        knn_sim = int(n["knn_similarity"] or 0)
        vec_cluster = n["vector_cluster"] or profile_out["activeCareerVector"]

        nodes_out.append(
            {
                "id": n["id"],
                "name": n["full_name"],
                "full_name": n["full_name"],
                "role": n["role"] or "",
                "company": n["company"] or "",
                "location": n["location"] or "Bay Area, CA",
                "degree": int(n["degree"]),
                "trustScore": round(float(n["trust_score"] or 0.5), 2),
                "trust_score": round(float(n["trust_score"] or 0.5), 2),
                "strategicValue": int(n["strategic_value"] or 50),
                "strategic_value": int(n["strategic_value"] or 50),
                "authorityLevel": n["authority_level"] or "Staff/Principal",
                "cluster": n["cluster"] or "Robotics & Embodied AI",
                "skills": sk,
                "pastState3YrsAgo": (
                    {
                        "role": past_role,
                        "similarityScore": knn_sim if knn_sim > 0 else 85,
                        "vectorCluster": vec_cluster,
                    }
                    if past_role or knn_sim > 0
                    else None
                ),
                "githubOverlap": n["github_overlap"] or "",
                "linkedinUrl": n["linkedin_url"] or "",
                "connectedOn": n["connected_on"] or "",
                "lastInteractionAt": n["last_interaction_at"] or "",
                "messageCount": int(n["message_count"] or 0),
                "betweennessCentrality": round(float(n["betweenness_centrality"] or 0.0), 4),
                "pagerank": round(float(n["pagerank"] or 0.0), 4),
                "evScore": int(n["ev_score"] or 0),
                "conversionProb": round(float(n["conversion_prob"] or 0.0), 1),
                "notes": n["notes"] or "",
                "context": n["notes"] or "",
            }
        )

    edge_rows = conn.execute(
        "SELECT id, source_id, target_id, weight, relationship_type, context FROM edges WHERE user_id = ?",
        (user_id,),
    ).fetchall()

    edges_out = []
    for e in edge_rows:
        src = "user-root" if e["source_id"] in (root_id, user_id) else e["source_id"]
        tgt = "user-root" if e["target_id"] in (root_id, user_id) else e["target_id"]
        edges_out.append(
            {
                "id": str(e["id"]),
                "dbId": int(e["id"]),
                "source": src,
                "target": tgt,
                "weight": round(float(e["weight"] or 0.5), 2),
                "relationshipType": e["relationship_type"] or "direct",
                "context": e["context"] or "",
            }
        )

    return {
        "user_id": user_id,
        "profile": profile_out,
        "nodes": nodes_out,
        "edges": edges_out,
        "synced_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# ============================================================================
# CORE HEALTH & UNIFIED STATE ENDPOINTS
# ============================================================================

@app.get("/api/health")
def health_check(conn: sqlite3.Connection = Depends(get_db)):
    total = conn.execute("SELECT COUNT(*) AS c FROM nodes").fetchone()["c"]
    contacts = conn.execute("SELECT COUNT(*) AS c FROM nodes WHERE degree >= 1").fetchone()["c"]
    edges = conn.execute("SELECT COUNT(*) AS c FROM edges").fetchone()["c"]
    return {
        "status": "healthy",
        "database": str(DB_PATH),
        "total_nodes": total,
        "contact_nodes": contacts,
        "total_edges": edges,
        "registered_processors": len(registry.list_metadata()),
        "engine": "FastAPI + SQLite WAL + NetworkX",
    }


@app.get("/api/state/{user_id}")
def get_unified_state(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Returns canonical profile, skills, nodes, and edges from SQLite."""
    return serialize_full_state(conn, user_id)


@app.put("/api/state/{user_id}")
def replace_unified_state(
    user_id: str,
    payload: FullStateSyncPayload,
    conn: sqlite3.Connection = Depends(get_db),
):
    """Atomically restores or imports a full JSON snapshot into SQLite."""
    ensure_user_profile(conn, user_id)
    root_id = f"{user_id}_root"
    prof = payload.profile or {}

    name = prof.get("name") or prof.get("full_name") or "Anthony Mikinka"
    headline = prof.get("headline") or ""
    company = prof.get("currentCompany") or prof.get("current_company") or "Tesla"
    location = prof.get("location") or "San Jose, CA"
    goal_mode = prof.get("activeGoalMode") or prof.get("active_goal_mode") or "trajectory"
    vector = prof.get("activeCareerVector") or prof.get("active_career_vector") or "Principal Embodied AI & Humanoid Data Architect"
    repos = prof.get("repositories") or []
    target_cos = prof.get("targetCompanies") or prof.get("target_companies") or []
    target_roles = prof.get("target_roles") or []

    conn.execute(
        """
        UPDATE users SET
            full_name = ?, headline = ?, current_company = ?, location = ?,
            active_goal_mode = ?, active_career_vector = ?,
            repositories_json = ?, target_companies_json = ?, target_roles_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            name, headline, company, location, goal_mode, vector,
            json.dumps(repos), json.dumps(target_cos), json.dumps(target_roles), user_id,
        ),
    )

    if "skills" in prof and isinstance(prof["skills"], list):
        conn.execute("DELETE FROM user_skills WHERE user_id = ?", (user_id,))
        for sk in prof["skills"]:
            sname = sk.get("name") or sk.get("skill_name")
            if sname:
                conn.execute(
                    "INSERT OR REPLACE INTO user_skills (user_id, skill_name, category, proficiency) VALUES (?, ?, ?, ?)",
                    (user_id, sname, sk.get("category", "Systems"), int(sk.get("proficiency", 88))),
                )

    conn.execute("DELETE FROM edges WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM nodes WHERE user_id = ? AND degree >= 1", (user_id,))

    valid_node_ids = {root_id}
    for n in payload.nodes:
        nid = n.get("id") or f"{user_id}_n_{int(time.time() * 1000)}"
        if nid in ("user-root", root_id):
            continue
        valid_node_ids.add(nid)
        past_obj = n.get("pastState3YrsAgo") or {}
        conn.execute(
            """
            INSERT OR REPLACE INTO nodes (
                id, user_id, full_name, role, company, location, degree,
                trust_score, strategic_value, authority_level, cluster,
                skills_json, past_role_3yrs_ago, knn_similarity, vector_cluster,
                github_overlap, linkedin_url, connected_on, message_count, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                nid,
                user_id,
                n.get("name") or n.get("full_name") or "Contact",
                n.get("role") or "",
                n.get("company") or "",
                n.get("location") or "Bay Area, CA",
                int(n.get("degree", 1)),
                float(n.get("trustScore") if n.get("trustScore") is not None else n.get("trust_score", 0.5)),
                int(n.get("strategicValue") if n.get("strategicValue") is not None else n.get("strategic_value", 60)),
                n.get("authorityLevel") or n.get("authority_level") or "Staff/Principal",
                n.get("cluster") or "Robotics & Embodied AI",
                json.dumps(n.get("skills") or []),
                past_obj.get("role") or n.get("past_role_3yrs_ago") or "",
                int(past_obj.get("similarityScore") or n.get("knn_similarity") or 0),
                past_obj.get("vectorCluster") or n.get("vector_cluster") or "",
                n.get("githubOverlap") or n.get("github_overlap") or "",
                n.get("linkedinUrl") or n.get("linkedin_url") or "",
                n.get("connectedOn") or n.get("connected_on") or "",
                int(n.get("messageCount") if n.get("messageCount") is not None else n.get("message_count", 0)),
                n.get("notes") or n.get("context") or "",
            ),
        )

    for e in payload.edges:
        src = _normalize_endpoint_id(e.get("source") or e.get("source_id") or "", user_id)
        tgt = _normalize_endpoint_id(e.get("target") or e.get("target_id") or "", user_id)
        if src in valid_node_ids and tgt in valid_node_ids and src != tgt:
            conn.execute(
                """
                INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    src,
                    tgt,
                    float(e.get("weight", 0.7)),
                    e.get("relationshipType") or e.get("relationship_type") or "direct",
                    e.get("context") or "",
                ),
            )

    conn.commit()
    registry.run_pipeline(conn, user_id, ["centrality", "ev"])
    return serialize_full_state(conn, user_id)


# ============================================================================
# USER PROFILE, SKILLS & GRAPH CRUD ENDPOINTS
# ============================================================================

@app.get("/api/users/{user_id}")
def get_user_profile(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    ensure_user_profile(conn, user_id)
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    user_data = dict(row)
    user_data["repositories"] = json.loads(user_data.get("repositories_json") or "[]")
    user_data["target_roles"] = json.loads(user_data.get("target_roles_json") or "[]")
    user_data["target_companies"] = json.loads(user_data.get("target_companies_json") or "[]")
    skills = conn.execute(
        "SELECT * FROM user_skills WHERE user_id = ? ORDER BY proficiency DESC", (user_id,)
    ).fetchall()
    user_data["skills"] = [dict(s) for s in skills]
    return user_data


@app.post("/api/users/{user_id}")
def update_user_profile(user_id: str, update: UserProfileUpdate, conn: sqlite3.Connection = Depends(get_db)):
    ensure_user_profile(conn, user_id)
    existing = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    name = update.full_name or update.name or existing["full_name"]
    headline = update.headline if update.headline is not None else existing["headline"]
    company = update.current_company or update.currentCompany or existing["current_company"]
    location = update.location or existing["location"] or "San Jose, CA"
    goal_mode = update.active_goal_mode or update.activeGoalMode or existing["active_goal_mode"] or "trajectory"
    vector = update.active_career_vector or update.activeCareerVector or existing["active_career_vector"] or ""

    repos = (
        update.repositories
        if update.repositories is not None
        else json.loads(existing["repositories_json"] or "[]")
    )
    target_roles = (
        update.target_roles
        if update.target_roles is not None
        else json.loads(existing["target_roles_json"] or "[]")
    )
    target_companies = (
        update.target_companies
        if update.target_companies is not None
        else (
            update.targetCompanies
            if update.targetCompanies is not None
            else json.loads(existing["target_companies_json"] or "[]")
        )
    )

    conn.execute(
        """
        UPDATE users SET
            full_name = ?, headline = ?, current_company = ?, location = ?,
            active_goal_mode = ?, active_career_vector = ?,
            repositories_json = ?, target_roles_json = ?, target_companies_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            name, headline, company, location, goal_mode, vector,
            json.dumps(repos), json.dumps(target_roles), json.dumps(target_companies), user_id,
        ),
    )

    # Also keep root node synced with user identity
    root_id = f"{user_id}_root"
    conn.execute(
        "UPDATE nodes SET full_name = ?, role = ?, company = ?, location = ? WHERE id = ?",
        (name, headline, company, location, root_id),
    )

    if update.skills is not None:
        conn.execute("DELETE FROM user_skills WHERE user_id = ?", (user_id,))
        skill_names = []
        for sk in update.skills:
            sname = sk.skill_name or sk.name
            if sname:
                skill_names.append(sname)
                conn.execute(
                    "INSERT OR REPLACE INTO user_skills (user_id, skill_name, category, proficiency) VALUES (?, ?, ?, ?)",
                    (user_id, sname, sk.category, sk.proficiency),
                )
        conn.execute(
            "UPDATE nodes SET skills_json = ? WHERE id = ?",
            (json.dumps(skill_names), root_id),
        )

    conn.commit()
    return serialize_full_state(conn, user_id)


@app.get("/api/graph/{user_id}")
def get_network_graph(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    ensure_user_profile(conn, user_id)
    G = build_nx_graph(conn, user_id)
    centrality = compute_centrality_metrics(G)
    paths = calculate_warm_paths(G, user_id)

    nodes_out = []
    for n in G.nodes:
        data = dict(G.nodes[n])
        cent = centrality.get(n, {"betweenness": 0.0, "degree": 0.0})
        data["betweenness_centrality"] = cent["betweenness"]
        data["degree_centrality"] = cent["degree"]
        nodes_out.append(data)

    edge_rows = conn.execute(
        "SELECT id, source_id, target_id, weight, relationship_type, context FROM edges WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    edges_out = [
        {
            "id": r["id"],
            "source": r["source_id"],
            "target": r["target_id"],
            "weight": round(float(r["weight"]), 2),
            "relationship_type": r["relationship_type"],
            "context": r["context"] or "",
        }
        for r in edge_rows
    ]

    first_deg = [n for n in nodes_out if n.get("degree") == 1]
    second_deg = [n for n in nodes_out if n.get("degree") == 2]
    third_deg = [n for n in nodes_out if n.get("degree") == 3]
    avg_trust = round(sum(n.get("trust_score", 0.5) for n in first_deg) / len(first_deg), 2) if first_deg else 0.0
    top_bridges = sorted(first_deg, key=lambda x: x.get("betweenness_centrality", 0), reverse=True)[:5]

    return {
        "user_id": user_id,
        "nodes": nodes_out,
        "edges": edges_out,
        "calculated_paths": paths,
        "kpi": {
            "total_nodes": len(nodes_out),
            "first_degree_count": len(first_deg),
            "second_degree_count": len(second_deg),
            "third_degree_count": len(third_deg),
            "avg_first_degree_trust": avg_trust,
            "high_probability_paths": len([p for p in paths if p.get("conversion_prob", 0) >= 60.0]),
        },
        "top_bridges": top_bridges,
    }


@app.post("/api/nodes")
def create_node(node: NodeCreate, conn: sqlite3.Connection = Depends(get_db)):
    ensure_user_profile(conn, node.user_id)
    full_name = (node.full_name or node.name or "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Contact name is required")

    node_id = node.id or f"{node.user_id}_n_{int(time.time() * 1000)}"
    trust = float(node.trust_score if node.trust_score is not None else (node.trustScore if node.trustScore is not None else 0.75))
    strat = int(node.strategic_value if node.strategic_value is not None else (node.strategicValue if node.strategicValue is not None else 80))

    inferred = classify_contact_attributes(node.role or "", node.company or "")
    auth = node.authority_level or node.authorityLevel or inferred["authority_level"]
    cluster = node.cluster or inferred["cluster"]
    skills = node.skills if node.skills else inferred["skills"]
    gh_overlap = node.github_overlap or node.githubOverlap or ""

    conn.execute(
        """
        INSERT OR REPLACE INTO nodes (
            id, user_id, full_name, role, company, location, degree,
            trust_score, strategic_value, authority_level, cluster,
            skills_json, past_role_3yrs_ago, knn_similarity, vector_cluster,
            github_overlap, linkedin_url, connected_on, message_count, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            node_id,
            node.user_id,
            full_name,
            node.role or "",
            node.company or "",
            node.location or "Bay Area, CA",
            node.degree,
            trust,
            strat,
            auth,
            cluster,
            json.dumps(skills),
            node.past_role_3yrs_ago or "",
            int(node.knn_similarity or 0),
            node.vector_cluster or "",
            gh_overlap,
            node.linkedin_url or "",
            node.connected_on or time.strftime("%Y-%m-%d"),
            node.message_count,
            node.notes or "",
        ),
    )

    root_id = f"{node.user_id}_root"
    if node.degree == 1:
        conn.execute(
            """
            INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
            VALUES (?, ?, ?, ?, 'direct', ?)
            """,
            (node.user_id, root_id, node_id, trust, node.notes or "Direct 1st-degree connection"),
        )
    elif node.bridge_id:
        bridge_src = _normalize_endpoint_id(node.bridge_id, node.user_id)
        bw = float(node.bridge_weight if node.bridge_weight is not None else trust)
        conn.execute(
            """
            INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
            VALUES (?, ?, ?, ?, 'bridge', ?)
            """,
            (node.user_id, bridge_src, node_id, bw, node.notes or "Warm bridge connection"),
        )

    conn.commit()
    registry.run_pipeline(conn, node.user_id, ["bridge_synthesis", "knn_trajectory", "centrality", "ev"])
    return {"status": "created", "node_id": node_id, "state": serialize_full_state(conn, node.user_id)}


@app.patch("/api/nodes/{node_id}")
def update_node(node_id: str, patch: NodePatch, conn: sqlite3.Connection = Depends(get_db)):
    existing = conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Node not found")

    user_id = existing["user_id"]
    root_id = f"{user_id}_root"
    updates = []
    params: List[Any] = []

    final_name = patch.full_name if patch.full_name is not None else patch.name
    if final_name is not None:
        updates.append("full_name = ?")
        params.append(final_name)
    if patch.role is not None:
        updates.append("role = ?")
        params.append(patch.role)
    if patch.company is not None:
        updates.append("company = ?")
        params.append(patch.company)
    if patch.location is not None:
        updates.append("location = ?")
        params.append(patch.location)
    if patch.degree is not None:
        updates.append("degree = ?")
        params.append(patch.degree)

    final_trust = patch.trust_score if patch.trust_score is not None else patch.trustScore
    if final_trust is not None:
        clamped = round(max(0.05, min(0.99, float(final_trust))), 2)
        updates.append("trust_score = ?")
        params.append(clamped)
        conn.execute(
            """
            UPDATE edges SET weight = ?
            WHERE user_id = ? AND (
                (source_id = ? AND target_id = ?) OR
                (source_id = ? AND target_id = ?)
            )
            """,
            (clamped, user_id, root_id, node_id, node_id, root_id),
        )

    final_strat = patch.strategic_value if patch.strategic_value is not None else patch.strategicValue
    if final_strat is not None:
        updates.append("strategic_value = ?")
        params.append(final_strat)

    final_auth = patch.authority_level if patch.authority_level is not None else patch.authorityLevel
    if final_auth is not None:
        updates.append("authority_level = ?")
        params.append(final_auth)
    if patch.cluster is not None:
        updates.append("cluster = ?")
        params.append(patch.cluster)
    if patch.skills is not None:
        updates.append("skills_json = ?")
        params.append(json.dumps(patch.skills))
    if patch.past_role_3yrs_ago is not None:
        updates.append("past_role_3yrs_ago = ?")
        params.append(patch.past_role_3yrs_ago)
    if patch.knn_similarity is not None:
        updates.append("knn_similarity = ?")
        params.append(patch.knn_similarity)

    final_gh = patch.github_overlap if patch.github_overlap is not None else patch.githubOverlap
    if final_gh is not None:
        updates.append("github_overlap = ?")
        params.append(final_gh)
    if patch.linkedin_url is not None:
        updates.append("linkedin_url = ?")
        params.append(patch.linkedin_url)
    if patch.notes is not None:
        updates.append("notes = ?")
        params.append(patch.notes)

    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        query = f"UPDATE nodes SET {', '.join(updates)} WHERE id = ?"
        params.append(node_id)
        conn.execute(query, tuple(params))
        conn.commit()
        registry.run_pipeline(conn, user_id, ["centrality", "ev"])

    return {"status": "updated", "node_id": node_id}


@app.delete("/api/nodes/{node_id}")
def delete_node(node_id: str, conn: sqlite3.Connection = Depends(get_db)):
    existing = conn.execute("SELECT user_id FROM nodes WHERE id = ?", (node_id,)).fetchone()
    user_id = existing["user_id"] if existing else "default_user"
    conn.execute("DELETE FROM edges WHERE source_id = ? OR target_id = ?", (node_id, node_id))
    conn.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
    conn.commit()
    return {"status": "deleted", "node_id": node_id, "user_id": user_id}


@app.post("/api/edges")
def create_or_update_edge(edge: EdgeCreate, conn: sqlite3.Connection = Depends(get_db)):
    ensure_user_profile(conn, edge.user_id)
    src = _normalize_endpoint_id(edge.source_id or edge.source or "", edge.user_id)
    tgt = _normalize_endpoint_id(edge.target_id or edge.target or "", edge.user_id)
    if not src or not tgt or src == tgt:
        raise HTTPException(status_code=400, detail="Valid distinct source and target required")

    conn.execute(
        """
        INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, source_id, target_id) DO UPDATE SET
            weight = excluded.weight,
            relationship_type = excluded.relationship_type,
            context = excluded.context
        """,
        (edge.user_id, src, tgt, edge.weight, edge.relationship_type, edge.context or ""),
    )
    conn.commit()
    registry.run_pipeline(conn, edge.user_id, ["centrality", "ev"])
    return {"status": "success", "state": serialize_full_state(conn, edge.user_id)}


@app.delete("/api/edges/{edge_id}")
def delete_edge(
    edge_id: str,
    user_id: str = "default_user",
    source: Optional[str] = None,
    target: Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_db),
):
    if edge_id.isdigit():
        conn.execute("DELETE FROM edges WHERE id = ?", (int(edge_id),))
    elif source and target:
        src = _normalize_endpoint_id(source, user_id)
        tgt = _normalize_endpoint_id(target, user_id)
        conn.execute(
            "DELETE FROM edges WHERE user_id = ? AND ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?))",
            (user_id, src, tgt, tgt, src),
        )
    conn.commit()
    return {"status": "deleted", "edge_id": edge_id}


# ============================================================================
# OUTREACH, ARCHIVE INGESTION (.CSV + .ZIP), & REAL GITHUB REPO DISCOVERY
# ============================================================================

@app.get("/api/outreach/{user_id}/{target_id}")
def get_outreach_for_target(user_id: str, target_id: str, conn: sqlite3.Connection = Depends(get_db)):
    ensure_user_profile(conn, user_id)
    G = build_nx_graph(conn, user_id)
    paths = calculate_warm_paths(G, user_id)
    matched = next((p for p in paths if p["target_id"] == target_id), None)

    user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    user_name = user_row["full_name"] if user_row else "Anthony Mikinka"
    user_headline = user_row["headline"] if user_row else "Humanoid Robotics Data Operations & Data Platform Architecture"

    skills_rows = conn.execute("SELECT skill_name FROM user_skills WHERE user_id = ?", (user_id,)).fetchall()
    user_skills = [r["skill_name"] for r in skills_rows]

    target_node = conn.execute("SELECT * FROM nodes WHERE id = ?", (target_id,)).fetchone()
    if not target_node:
        raise HTTPException(status_code=404, detail="Target node not found")

    if matched:
        bridge_name = matched["bridge_name"]
        bridge_comp = matched["bridge_company"]
        shared_skills = matched["shared_skills"]
    else:
        fallback_bridge = conn.execute(
            "SELECT * FROM nodes WHERE user_id = ? AND degree = 1 ORDER BY trust_score DESC LIMIT 1",
            (user_id,),
        ).fetchone()
        bridge_name = fallback_bridge["full_name"] if fallback_bridge else "Direct Outreach"
        bridge_comp = fallback_bridge["company"] if fallback_bridge else user_row["current_company"]
        shared_skills = user_skills[:2]

    blurbs = generate_outreach_blurbs(
        user_name=user_name,
        user_headline=user_headline,
        user_skills=user_skills,
        bridge_name=bridge_name,
        bridge_company=bridge_comp,
        target_name=target_node["full_name"],
        target_role=target_node["role"] or "Engineering Leader",
        target_company=target_node["company"] or "Target Org",
        shared_skills=shared_skills,
    )

    return {
        "target_id": target_id,
        "bridge_name": bridge_name,
        "bridge_company": bridge_comp,
        "conversion_prob": matched["conversion_prob"] if matched else 50.0,
        "friction_cost": matched["friction_cost"] if matched else 0.8,
        "outreach": blurbs,
    }


@app.post("/api/ingest/linkedin")
async def ingest_linkedin(
    user_id: str = Form("default_user"),
    file: UploadFile = File(...),
    conn: sqlite3.Connection = Depends(get_db),
):
    """Ingests either a LinkedIn `.zip` export OR standalone `Connections.csv` into SQLite."""
    try:
        contents = await file.read()

        async def broadcast_progress(msg: str):
            await ws_manager.broadcast({"type": "ingest_progress", "message": msg})

        def progress_cb(msg: str):
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(broadcast_progress(msg))
            except Exception:
                pass

        parser = LinkedInArchiveParser(conn, user_id, log_cb=progress_cb)
        results = parser.parse_input(contents, filename=file.filename or "Connections.csv")
        state = serialize_full_state(conn, user_id)

        await ws_manager.broadcast({"type": "ingest_complete", "results": results})
        return {"status": "success", "results": results, "state": state}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ingest/resume")
async def ingest_resume(
    user_id: str = Form("default_user"),
    full_name: Optional[str] = Form(None),
    headline: Optional[str] = Form(None),
    resume_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    conn: sqlite3.Connection = Depends(get_db),
):
    text_content = resume_text or ""
    if file:
        file_bytes = await file.read()
        text_content += "\n" + file_bytes.decode("utf-8", errors="replace")

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="Provide resume text or upload a text/markdown resume file.")

    result = ingest_resume_into_db(
        conn=conn,
        user_id=user_id,
        resume_text=text_content,
        full_name=full_name,
        headline=headline,
    )
    return {"status": "success", "result": result, "state": serialize_full_state(conn, user_id)}


@app.get("/api/discover/github/{user_id}")
def discover_real_github_network(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """
    Queries the live public GitHub API for real stargazers & contributors across the user's
    configured GitHub repositories and cross-references them against 1st-degree LinkedIn bridges.
    Zero fake or hardcoded people.
    """
    ensure_user_profile(conn, user_id)
    user_row = conn.execute("SELECT repositories_json, full_name FROM users WHERE id = ?", (user_id,)).fetchone()
    repos = json.loads(user_row["repositories_json"] or "[]")
    owner_logins = {r.split("/")[0].lower() for r in repos if "/" in r}

    first_deg = conn.execute(
        "SELECT id, full_name, company, trust_score FROM nodes WHERE user_id = ? AND degree = 1 ORDER BY trust_score DESC",
        (user_id,),
    ).fetchall()

    existing_names = {
        r["full_name"].lower()
        for r in conn.execute("SELECT full_name FROM nodes WHERE user_id = ?", (user_id,)).fetchall()
    }

    discovered: List[Dict[str, Any]] = []
    seen_logins = set()
    errors: List[str] = []

    def _gh_get(url: str) -> Any:
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "CareerNetworkOptimizer/2.0",
            },
        )
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            return json.loads(resp.read().decode("utf-8"))

    for repo in repos[:6]:
        if "/" not in repo:
            continue
        for endpoint, signal_label in (
            (f"https://api.github.com/repos/{repo}/contributors?per_page=10", "Repository Contributor"),
            (f"https://api.github.com/repos/{repo}/stargazers?per_page=15", "Repository Stargazer"),
        ):
            try:
                items = _gh_get(endpoint)
                if not isinstance(items, list):
                    continue
                for item in items:
                    login = (item.get("login") or "").strip()
                    if not login or login.lower() in owner_logins or login.lower() in seen_logins:
                        continue
                    seen_logins.add(login.lower())

                    # Fetch public profile metadata if available (cap detail calls to stay responsive)
                    full_name = login
                    company = ""
                    bio = ""
                    location = "Global"
                    if len(discovered) < 12:
                        try:
                            prof = _gh_get(f"https://api.github.com/users/{login}")
                            full_name = (prof.get("name") or login).strip()
                            company = (prof.get("company") or "").lstrip("@").strip()
                            bio = (prof.get("bio") or "").strip()
                            location = (prof.get("location") or "Global").strip()
                        except Exception:
                            pass

                    if full_name.lower() in existing_names:
                        continue

                    matched_bridge = None
                    if company:
                        matched_bridge = next(
                            (b for b in first_deg if company.lower() in (b["company"] or "").lower() or (b["company"] or "").lower() in company.lower()),
                            None,
                        )
                    if not matched_bridge and first_deg:
                        matched_bridge = first_deg[0]

                    attrs = classify_contact_attributes(bio or signal_label, company or "Open Source")
                    discovered.append(
                        {
                            "id": f"gh_{login.lower()}",
                            "login": login,
                            "name": full_name,
                            "role": bio[:80] if bio else f"Open-Source Engineer (@{login})",
                            "company": company or "GitHub Open Source",
                            "location": location,
                            "repoSource": repo,
                            "githubUrl": f"https://github.com/{login}",
                            "githubSignal": f"{signal_label} on {repo}",
                            "authorityLevel": attrs["authority_level"],
                            "cluster": attrs["cluster"],
                            "skills": attrs["skills"],
                            "trustScore": 0.72,
                            "strategicValue": 85 if company else 74,
                            "bridgeNodeId": matched_bridge["id"] if matched_bridge else "user-root",
                            "bridgeName": matched_bridge["full_name"] if matched_bridge else "Direct Open-Source Warm Intro",
                            "bridgeCompany": matched_bridge["company"] if matched_bridge else "",
                            "bridgeEdgeWeight": round(float(matched_bridge["trust_score"]) * 0.85, 2) if matched_bridge else 0.65,
                            "bridgeContext": (
                                f"Warm bridge via {matched_bridge['full_name']} ({matched_bridge['company']}) + {repo}"
                                if matched_bridge
                                else f"Direct open-source contributor/stargazer overlap on {repo}"
                            ),
                        }
                    )
            except urllib.error.HTTPError as he:
                errors.append(f"{repo}: HTTP {he.code}")
                break
            except Exception as ex:
                errors.append(f"{repo}: {str(ex)}")
                break

    return {
        "status": "success",
        "repositories_scanned": repos,
        "candidates": discovered,
        "notes": errors,
    }


@app.post("/api/reset/{user_id}")
def reset_clean_database(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Resets database for `user_id` to clean zero-placeholder production state."""
    seed_database(conn, user_id, include_demo_contacts=False)
    return {"status": "success", "state": serialize_full_state(conn, user_id)}


@app.post("/api/demo-seed/{user_id}")
def reset_to_clean_alias(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    seed_database(conn, user_id, include_demo_contacts=False)
    return {"status": "success", "state": serialize_full_state(conn, user_id)}


@app.get("/api/export/sql/{user_id}", response_class=PlainTextResponse)
def export_seed_sql(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    """Generates a valid, schema-accurate SQLite transaction script from live database state."""
    ensure_user_profile(conn, user_id)

    def esc(val: Any) -> str:
        return str(val if val is not None else "").replace("'", "''")

    u = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    skills = conn.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,)).fetchall()
    nodes = conn.execute("SELECT * FROM nodes WHERE user_id = ?", (user_id,)).fetchall()
    edges = conn.execute("SELECT * FROM edges WHERE user_id = ?", (user_id,)).fetchall()

    lines = [
        "-- Career Network Optimizer — Canonical SQLite WAL Seed Snapshot",
        f"-- User: {u['full_name']} ({user_id})",
        "PRAGMA foreign_keys = ON;",
        "BEGIN TRANSACTION;",
        "",
        f"INSERT OR REPLACE INTO users (id, full_name, headline, current_company, location, active_goal_mode, active_career_vector, repositories_json, target_roles_json, target_companies_json) VALUES ('{esc(u['id'])}', '{esc(u['full_name'])}', '{esc(u['headline'])}', '{esc(u['current_company'])}', '{esc(u['location'])}', '{esc(u['active_goal_mode'])}', '{esc(u['active_career_vector'])}', '{esc(u['repositories_json'])}', '{esc(u['target_roles_json'])}', '{esc(u['target_companies_json'])}');",
        "",
    ]

    for s in skills:
        lines.append(
            f"INSERT OR REPLACE INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('{esc(s['user_id'])}', '{esc(s['skill_name'])}', '{esc(s['category'])}', {int(s['proficiency'])});"
        )
    lines.append("")

    for n in nodes:
        lines.append(
            f"INSERT OR REPLACE INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, authority_level, cluster, skills_json, past_role_3yrs_ago, knn_similarity, vector_cluster, github_overlap, linkedin_url, connected_on, message_count, notes) VALUES ('{esc(n['id'])}', '{esc(n['user_id'])}', '{esc(n['full_name'])}', '{esc(n['role'])}', '{esc(n['company'])}', '{esc(n['location'])}', {int(n['degree'])}, {float(n['trust_score'])}, {int(n['strategic_value'])}, '{esc(n['authority_level'])}', '{esc(n['cluster'])}', '{esc(n['skills_json'])}', '{esc(n['past_role_3yrs_ago'])}', {int(n['knn_similarity'] or 0)}, '{esc(n['vector_cluster'])}', '{esc(n['github_overlap'])}', '{esc(n['linkedin_url'])}', '{esc(n['connected_on'])}', {int(n['message_count'] or 0)}, '{esc(n['notes'])}');"
        )
    lines.append("")

    for e in edges:
        lines.append(
            f"INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context) VALUES ('{esc(e['user_id'])}', '{esc(e['source_id'])}', '{esc(e['target_id'])}', {float(e['weight'])}, '{esc(e['relationship_type'])}', '{esc(e['context'])}');"
        )

    lines.extend(["", "COMMIT;"])
    return "\n".join(lines)


@app.get("/api/export/db")
def export_sqlite_binary():
    """Downloads the live SQLite `optimizer.db` file."""
    if not DB_PATH.exists():
        init_db()
    return FileResponse(
        path=str(DB_PATH),
        filename="optimizer.db",
        media_type="application/x-sqlite3",
    )


# ============================================================================
# MODULAR RECALCULATIONS & PROCESSING API
# ============================================================================

@app.get("/api/process/modules")
def list_processing_modules():
    return {
        "status": "success",
        "modules": [m.dict() for m in registry.list_metadata()],
    }


@app.post("/api/process/run")
def run_processing_module(req: ProcessorRunRequest, conn: sqlite3.Connection = Depends(get_db)):
    try:
        ensure_user_profile(conn, req.user_id)
        res = registry.run_processor(req.processor_id, conn, req.user_id, req.params)
        return {
            "status": "success",
            "result": res.dict(),
            "state": serialize_full_state(conn, req.user_id),
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process/pipeline")
def run_processing_pipeline(req: PipelineRunRequest, conn: sqlite3.Connection = Depends(get_db)):
    try:
        ensure_user_profile(conn, req.user_id)
        summary = registry.run_pipeline(conn, req.user_id, req.processors, req.params_map)
        return {
            "status": "success",
            "pipeline": summary,
            "state": serialize_full_state(conn, req.user_id),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/ingest")
async def websocket_ingest(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "ack", "payload": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
