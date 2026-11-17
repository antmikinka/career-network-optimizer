import os
import io
import json
import sqlite3
import asyncio
from typing import Dict, List, Any, Optional
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.db import get_db, init_db, DB_PATH
from app.seed import seed_database
from app.engine.pathfinder import (
    build_nx_graph,
    compute_centrality_metrics,
    calculate_warm_paths,
    generate_outreach_blurbs
)
from app.engine.matcher import compute_node_strategic_value
from app.ingest.linkedin_zip import LinkedInArchiveParser
from app.ingest.resume_parser import ingest_resume_into_db, parse_resume_text
from app.engine.recalculations import registry

# Initialize database schema on startup
init_db()

app = FastAPI(
    title="Career Network Optimizer Engine",
    description="Zero-friction relational-graph hybrid engine with weighted Dijkstra pathfinding",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    headline: Optional[str] = None
    current_company: Optional[str] = None
    target_roles: Optional[List[str]] = None
    target_companies: Optional[List[str]] = None

class SkillItem(BaseModel):
    skill_name: str
    category: str = "Core"
    proficiency: int = Field(default=80, ge=1, le=100)

class NodeCreate(BaseModel):
    id: Optional[str] = None
    user_id: str
    full_name: str
    role: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = "SF Bay Area"
    degree: int = Field(default=1, ge=0, le=3)
    trust_score: float = Field(default=0.5, ge=0.05, le=1.0)
    strategic_value: int = Field(default=50, ge=0, le=100)
    skills: List[str] = []
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None

class NodePatch(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    degree: Optional[int] = None
    trust_score: Optional[float] = None
    strategic_value: Optional[int] = None
    skills: Optional[List[str]] = None
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None

class EdgeCreate(BaseModel):
    user_id: str
    source_id: str
    target_id: str
    weight: float = Field(default=0.5, ge=0.05, le=1.0)
    relationship_type: str = "direct"
    context: Optional[str] = None

# WebSocket Connection Manager for Live Ingest Progress
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

@app.get("/api/health")
def health_check(conn: sqlite3.Connection = Depends(get_db)):
    count = conn.execute("SELECT count(*) as c FROM nodes").fetchone()["c"]
    return {
        "status": "healthy",
        "database": str(DB_PATH),
        "total_nodes": count,
        "engine": "FastAPI + SQLite + NetworkX"
    }

@app.get("/api/users/{user_id}")
def get_user_profile(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        # Auto-seed if database is empty for demo convenience
        seed_database(conn, user_id)
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        
    user_data = dict(row)
    user_data["target_roles"] = json.loads(user_data.get("target_roles_json") or "[]")
    user_data["target_companies"] = json.loads(user_data.get("target_companies_json") or "[]")
    
    skills = conn.execute("SELECT * FROM user_skills WHERE user_id = ? ORDER BY proficiency DESC", (user_id,)).fetchall()
    user_data["skills"] = [dict(s) for s in skills]
    return user_data

@app.post("/api/users/{user_id}")
def update_user_profile(user_id: str, update: UserProfileUpdate, conn: sqlite3.Connection = Depends(get_db)):
    existing = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    
    name = update.full_name or (existing["full_name"] if existing else "Alex Mercer")
    headline = update.headline or (existing["headline"] if existing else "Staff ML Systems Architect")
    company = update.current_company or (existing["current_company"] if existing else "Independent")
    
    target_roles = update.target_roles if update.target_roles is not None else (
        json.loads(existing["target_roles_json"]) if existing and existing["target_roles_json"] else []
    )
    target_companies = update.target_companies if update.target_companies is not None else (
        json.loads(existing["target_companies_json"]) if existing and existing["target_companies_json"] else []
    )
    
    conn.execute("""
        INSERT INTO users (id, full_name, headline, current_company, target_roles_json, target_companies_json)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            full_name = excluded.full_name,
            headline = excluded.headline,
            current_company = excluded.current_company,
            target_roles_json = excluded.target_roles_json,
            target_companies_json = excluded.target_companies_json
    """, (user_id, name, headline, company, json.dumps(target_roles), json.dumps(target_companies)))
    conn.commit()
    return {"status": "success", "user_id": user_id}

@app.get("/api/skills/{user_id}")
def get_user_skills(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    skills = conn.execute("SELECT * FROM user_skills WHERE user_id = ? ORDER BY category, proficiency DESC", (user_id,)).fetchall()
    return [dict(s) for s in skills]

@app.post("/api/skills/{user_id}")
def add_user_skill(user_id: str, item: SkillItem, conn: sqlite3.Connection = Depends(get_db)):
    conn.execute("""
        INSERT INTO user_skills (user_id, skill_name, category, proficiency)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, skill_name) DO UPDATE SET
            category = excluded.category,
            proficiency = excluded.proficiency
    """, (user_id, item.skill_name, item.category, item.proficiency))
    conn.commit()
    return {"status": "success", "skill": item.dict()}

@app.delete("/api/skills/{user_id}/{skill_name}")
def delete_user_skill(user_id: str, skill_name: str, conn: sqlite3.Connection = Depends(get_db)):
    conn.execute("DELETE FROM user_skills WHERE user_id = ? AND skill_name = ?", (user_id, skill_name))
    conn.commit()
    return {"status": "deleted", "skill_name": skill_name}

@app.get("/api/graph/{user_id}")
def get_network_graph(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    # Verify user exists or seed demo
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        seed_database(conn, user_id)
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        
    G = build_nx_graph(conn, user_id)
    centrality = compute_centrality_metrics(G)
    paths = calculate_warm_paths(G, user_id)
    
    # Format graph nodes
    nodes_out = []
    for n in G.nodes:
        data = dict(G.nodes[n])
        cent = centrality.get(n, {"betweenness": 0.0, "degree": 0.0})
        data["betweenness_centrality"] = cent["betweenness"]
        data["degree_centrality"] = cent["degree"]
        nodes_out.append(data)
        
    # Format edges
    edges_out = []
    for u, v, d in G.edges(data=True):
        edges_out.append({
            "source": u,
            "target": v,
            "weight": round(d.get("weight", 0.5), 2),
            "friction_cost": round(d.get("cost", 0.69), 2),
            "relationship_type": d.get("relationship_type", "direct"),
            "context": d.get("context", "")
        })
        
    # Aggregate KPIs
    first_deg = [n for n in nodes_out if n.get("degree") == 1]
    second_deg = [n for n in nodes_out if n.get("degree") == 2]
    third_deg = [n for n in nodes_out if n.get("degree") == 3]
    
    avg_trust = round(sum(n.get("trust_score", 0.5) for n in first_deg) / max(1, len(first_deg)), 2)
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
            "high_probability_paths": len([p for p in paths if p.get("conversion_prob", 0) >= 60.0])
        },
        "top_bridges": top_bridges
    }

@app.post("/api/nodes")
def create_node(node: NodeCreate, conn: sqlite3.Connection = Depends(get_db)):
    node_id = node.id or f"{node.user_id}_n_{int(asyncio.get_event_loop().time() * 1000)}"
    conn.execute("""
        INSERT INTO nodes (
            id, user_id, full_name, role, company, location, degree, trust_score,
            strategic_value, skills_json, linkedin_url, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        node_id, node.user_id, node.full_name, node.role, node.company, node.location,
        node.degree, node.trust_score, node.strategic_value, json.dumps(node.skills),
        node.linkedin_url, node.notes
    ))
    
    # If 1st degree, link automatically to root
    if node.degree == 1:
        root_id = f"{node.user_id}_root"
        conn.execute("""
            INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
            VALUES (?, ?, ?, ?, 'direct', ?)
        """, (node.user_id, root_id, node_id, node.trust_score, node.notes or "Direct connection"))
        
    conn.commit()
    return {"status": "created", "node_id": node_id}

@app.patch("/api/nodes/{node_id}")
def update_node(node_id: str, patch: NodePatch, conn: sqlite3.Connection = Depends(get_db)):
    existing = conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Node not found")
        
    updates = []
    params = []
    
    if patch.full_name is not None:
        updates.append("full_name = ?")
        params.append(patch.full_name)
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
    if patch.trust_score is not None:
        updates.append("trust_score = ?")
        params.append(patch.trust_score)
        # Also sync edge weight if connected to root
        conn.execute("UPDATE edges SET weight = ? WHERE (source_id = ? OR target_id = ?) AND relationship_type = 'linkedin_1st'", (patch.trust_score, node_id, node_id))
    if patch.strategic_value is not None:
        updates.append("strategic_value = ?")
        params.append(patch.strategic_value)
    if patch.skills is not None:
        updates.append("skills_json = ?")
        params.append(json.dumps(patch.skills))
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
        
    return {"status": "updated", "node_id": node_id}

@app.delete("/api/nodes/{node_id}")
def delete_node(node_id: str, conn: sqlite3.Connection = Depends(get_db)):
    conn.execute("DELETE FROM edges WHERE source_id = ? OR target_id = ?", (node_id, node_id))
    conn.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
    conn.commit()
    return {"status": "deleted", "node_id": node_id}

@app.post("/api/edges")
def create_or_update_edge(edge: EdgeCreate, conn: sqlite3.Connection = Depends(get_db)):
    conn.execute("""
        INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, source_id, target_id) DO UPDATE SET
            weight = excluded.weight,
            relationship_type = excluded.relationship_type,
            context = excluded.context
    """, (edge.user_id, edge.source_id, edge.target_id, edge.weight, edge.relationship_type, edge.context))
    conn.commit()
    return {"status": "success", "edge": edge.dict()}

@app.get("/api/outreach/{user_id}/{target_id}")
def get_outreach_for_target(user_id: str, target_id: str, conn: sqlite3.Connection = Depends(get_db)):
    # Run Dijkstra paths to find optimal bridge
    G = build_nx_graph(conn, user_id)
    paths = calculate_warm_paths(G, user_id)
    matched = next((p for p in paths if p["target_id"] == target_id), None)
    
    user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    user_name = user_row["full_name"] if user_row else "Alex Mercer"
    user_headline = user_row["headline"] if user_row else "Staff ML Systems Architect"
    
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
        # Fallback to highest trust 1st-degree node
        fallback_bridge = conn.execute("SELECT * FROM nodes WHERE user_id = ? AND degree = 1 ORDER BY trust_score DESC LIMIT 1", (user_id,)).fetchone()
        bridge_name = fallback_bridge["full_name"] if fallback_bridge else "Colleague"
        bridge_comp = fallback_bridge["company"] if fallback_bridge else "Tech"
        shared_skills = ["Distributed Systems", "AI Infrastructure"]
        
    blurbs = generate_outreach_blurbs(
        user_name=user_name,
        user_headline=user_headline,
        user_skills=user_skills,
        bridge_name=bridge_name,
        bridge_company=bridge_comp,
        target_name=target_node["full_name"],
        target_role=target_node["role"] or "Leader",
        target_company=target_node["company"] or "Target Organization",
        shared_skills=shared_skills
    )
    
    return {
        "target_id": target_id,
        "bridge_name": bridge_name,
        "bridge_company": bridge_comp,
        "conversion_prob": matched["conversion_prob"] if matched else 50.0,
        "friction_cost": matched["friction_cost"] if matched else 0.8,
        "outreach": blurbs
    }

@app.post("/api/ingest/linkedin")
async def ingest_linkedin(
    user_id: str = Form("default_user"),
    file: UploadFile = File(...),
    conn: sqlite3.Connection = Depends(get_db)
):
    try:
        contents = await file.read()
        zip_buffer = io.BytesIO(contents)
        
        async def broadcast_progress(msg: str):
            await ws_manager.broadcast({"type": "ingest_progress", "message": msg})
            
        # Synchronous callback wrapper
        def progress_cb(msg: str):
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(broadcast_progress(msg))
            except Exception:
                pass
                
        parser = LinkedInArchiveParser(conn, user_id, log_cb=progress_cb)
        results = parser.parse_archive(zip_buffer)
        
        await ws_manager.broadcast({
            "type": "ingest_complete",
            "results": results
        })
        
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ingest/resume")
async def ingest_resume(
    user_id: str = Form("default_user"),
    full_name: Optional[str] = Form(None),
    headline: Optional[str] = Form(None),
    resume_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    conn: sqlite3.Connection = Depends(get_db)
):
    text_content = resume_text or ""
    if file:
        file_bytes = await file.read()
        text_content += "\n" + file_bytes.decode("utf-8", errors="replace")
        
    if not text_content.strip():
        text_content = "Staff ML Systems Architect with deep expertise in PyTorch, Distributed Systems, ONNX/MLX Split-Graph Execution, and Humanoid Robotics Data Operations."
        
    result = ingest_resume_into_db(
        conn=conn,
        user_id=user_id,
        resume_text=text_content,
        full_name=full_name,
        headline=headline
    )
    return {"status": "success", "result": result}

@app.post("/api/demo-seed/{user_id}")
def reset_to_demo(user_id: str, conn: sqlite3.Connection = Depends(get_db)):
    seed_database(conn, user_id)
    return {"status": "success", "message": f"User {user_id} seeded with high-fidelity network topology."}

# ==========================================
# MODULAR RECALCULATIONS & PROCESSING API
# ==========================================

class ProcessorRunRequest(BaseModel):
    user_id: str = "default_user"
    processor_id: str
    params: Optional[Dict[str, Any]] = None

class PipelineRunRequest(BaseModel):
    user_id: str = "default_user"
    processors: Optional[List[str]] = None
    params_map: Optional[Dict[str, Dict[str, Any]]] = None

@app.get("/api/process/modules")
def list_processing_modules():
    """Lists all registered modular recalculation processors and their parameter schemas."""
    return {
        "status": "success",
        "modules": [m.dict() for m in registry.list_metadata()]
    }

@app.post("/api/process/run")
def run_processing_module(req: ProcessorRunRequest, conn: sqlite3.Connection = Depends(get_db)):
    """Executes a single recalculation processor with custom parameters."""
    try:
        res = registry.run_processor(req.processor_id, conn, req.user_id, req.params)
        return {"status": "success", "result": res.dict()}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process/pipeline")
def run_processing_pipeline(req: PipelineRunRequest, conn: sqlite3.Connection = Depends(get_db)):
    """Runs a sequenced pipeline of modular graph recalculations with parameter overrides."""
    try:
        summary = registry.run_pipeline(conn, req.user_id, req.processors, req.params_map)
        return {"status": "success", "pipeline": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/ingest")
async def websocket_ingest(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo heartbeat or client commands
            await websocket.send_json({"type": "ack", "payload": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
