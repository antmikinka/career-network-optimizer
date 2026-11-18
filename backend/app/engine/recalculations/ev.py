import json
import math
import time
import networkx as nx
from typing import Dict, Any, Optional
from .base import BaseProcessor, ProcessingResult


class EVProcessor(BaseProcessor):
    id = "ev"
    name = "Expected Career Value (EV) Engine"
    category = "Pathfinding & Value"
    description = "Calculates multi-hop logarithmic Dijkstra paths from user root and persists EV = P(Reach) * Authority * Synergy * GoalBoost into SQLite."
    parameters_schema = {
        "goal_mode": {
            "type": "string",
            "default": "trajectory",
            "enum": ["trajectory", "infiltration", "gravity", "structural"],
            "description": "Active optimization goal vector",
        },
        "ic_authority_weight": {"type": "number", "default": 0.5},
        "staff_authority_weight": {"type": "number", "default": 0.8},
        "exec_authority_weight": {"type": "number", "default": 1.0},
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}

        user_row = db_conn.execute(
            "SELECT active_goal_mode, target_companies_json FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        goal_mode = p.get("goal_mode") or (user_row["active_goal_mode"] if user_row and user_row["active_goal_mode"] else "trajectory")
        target_companies = {
            c.lower().strip()
            for c in json.loads(user_row["target_companies_json"] or "[]")
        } if user_row else set()

        auth_weights = {
            "IC": float(p.get("ic_authority_weight", 0.5)),
            "Staff/Principal": float(p.get("staff_authority_weight", 0.8)),
            "Director/VP/Founder": float(p.get("exec_authority_weight", 1.0)),
        }

        user_skills_rows = db_conn.execute(
            "SELECT skill_name, proficiency FROM user_skills WHERE user_id = ?",
            (user_id,),
        ).fetchall()
        user_skill_map = {r["skill_name"].lower(): float(r["proficiency"] or 85) for r in user_skills_rows}

        root_id = f"{user_id}_root"
        nodes = db_conn.execute(
            """
            SELECT id, full_name, role, company, degree, authority_level, cluster,
                   skills_json, knn_similarity, github_overlap
            FROM nodes WHERE user_id = ?
            """,
            (user_id,),
        ).fetchall()
        edges = db_conn.execute(
            "SELECT source_id, target_id, weight FROM edges WHERE user_id = ?",
            (user_id,),
        ).fetchall()

        G = nx.Graph()
        G.add_node(root_id, id=root_id, degree=0)
        for n in nodes:
            G.add_node(n["id"], **dict(n))

        for e in edges:
            src = root_id if e["source_id"] == user_id else e["source_id"]
            tgt = root_id if e["target_id"] == user_id else e["target_id"]
            w = max(0.05, min(0.99, float(e["weight"] or 0.5)))
            cost = -math.log(w)
            G.add_edge(src, tgt, weight=cost, prob_weight=w)

        # Single-source Dijkstra once in O((V + E) log V)
        if root_id in G:
            lengths, paths = nx.single_source_dijkstra(G, root_id, weight="weight")
        else:
            lengths, paths = {}, {}

        first_deg_by_cluster: Dict[str, int] = {}
        for n in nodes:
            if n["degree"] == 1:
                c = n["cluster"] or "Robotics & Embodied AI"
                first_deg_by_cluster[c] = first_deg_by_cluster.get(c, 0) + 1

        all_targets = [n for n in nodes if n["degree"] >= 2]
        ev_results = []
        nodes_updated = 0

        for target in all_targets:
            target_id = target["id"]
            if target_id not in lengths:
                db_conn.execute(
                    "UPDATE nodes SET ev_score = 0, conversion_prob = 0.0 WHERE id = ?",
                    (target_id,),
                )
                continue

            cost = lengths[target_id]
            path = paths[target_id]

            try:
                t_skills = json.loads(target["skills_json"] or "[]")
            except Exception:
                t_skills = []

            shared = [s for s in t_skills if s.lower() in user_skill_map]
            avg_prof = (sum(user_skill_map[s.lower()] for s in shared) / len(shared)) if shared else 75.0
            synergy_factor = round(0.68 + min(0.55, (len(shared) * 0.16) * (avg_prof / 92.0)), 2)
            synergy_bonus_pct = min(14, round(len(shared) * 4))

            raw_prob_pct = math.exp(-cost) * 100.0
            conv_prob_pct = min(98.0, max(8.0, round(raw_prob_pct + synergy_bonus_pct * 0.4, 1)))

            auth_tier = target["authority_level"] or "Staff/Principal"
            auth_mult = auth_weights.get(auth_tier, 0.8)
            knn_score = int(target["knn_similarity"] or 84)
            is_target_co = any(tc in (target["company"] or "").lower() for tc in target_companies if tc)

            if goal_mode == "trajectory":
                mode_mult = 0.85 + (knn_score / 100.0) * 0.45
            elif goal_mode == "infiltration":
                auth_boost = 1.28 if auth_mult >= 1.0 else 1.08 if auth_mult >= 0.8 else 0.78
                mode_mult = auth_boost * (1.15 if is_target_co else 0.90)
            elif goal_mode == "gravity":
                has_repo = bool(target["github_overlap"] and len(target["github_overlap"]) > 5)
                mode_mult = synergy_factor * (1.18 if has_repo else 0.95)
            else:
                c_count = first_deg_by_cluster.get(target["cluster"] or "Robotics & Embodied AI", 0)
                scarcity = 1.42 if c_count == 0 else 1.24 if c_count == 1 else 0.96
                bridge_cluster = G.nodes[path[1]].get("cluster") if len(path) > 2 else None
                cross_jump = bool(bridge_cluster and bridge_cluster != target["cluster"])
                mode_mult = scarcity * (1.12 if cross_jump else 1.0)

            raw_ev = (conv_prob_pct / 100.0) * (0.55 + auth_mult * 0.45) * synergy_factor * mode_mult * 100.0
            ev_score = min(99, max(15, round(raw_ev)))

            db_conn.execute(
                "UPDATE nodes SET ev_score = ?, conversion_prob = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (ev_score, conv_prob_pct, target_id),
            )
            nodes_updated += 1

            ev_results.append(
                {
                    "target_id": target_id,
                    "target_name": target["full_name"],
                    "company": target["company"],
                    "ev_score": ev_score,
                    "conversion_prob": conv_prob_pct,
                    "hops": len(path) - 1,
                }
            )

        db_conn.commit()
        ev_results.sort(key=lambda x: x["ev_score"], reverse=True)
        avg_ev = round(sum(x["ev_score"] for x in ev_results) / len(ev_results), 1) if ev_results else 0.0
        elapsed = (time.time() - start_time) * 1000

        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=nodes_updated,
            edges_updated=0,
            metrics={
                "goal_mode": goal_mode,
                "targets_evaluated": len(ev_results),
                "average_ev": avg_ev,
                "top_opportunities": ev_results[:5],
            },
            message=f"Computed & persisted EV across {len(ev_results)} targets (mean EV: {avg_ev}, mode: {goal_mode}).",
        )
