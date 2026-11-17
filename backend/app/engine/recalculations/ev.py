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
    description = "Calculates multi-hop logarithmic Dijkstra paths and evaluates EV = P(Reach) * Authority * Synergy * GoalBoost for all 2nd/3rd degree targets."
    parameters_schema = {
        "goal_mode": {
            "type": "string",
            "default": "trajectory",
            "enum": ["trajectory", "infiltration", "gravity", "structural"],
            "description": "Active optimization goal vector"
        },
        "ic_authority_weight": {
            "type": "number",
            "default": 0.5,
            "description": "Decision authority multiplier for ICs"
        },
        "staff_authority_weight": {
            "type": "number",
            "default": 0.8,
            "description": "Decision authority multiplier for Staff/Principal"
        },
        "exec_authority_weight": {
            "type": "number",
            "default": 1.0,
            "description": "Decision authority multiplier for Director/VP/Founders"
        }
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        goal_mode = p.get("goal_mode", "trajectory")
        auth_weights = {
            "IC": p.get("ic_authority_weight", 0.5),
            "Staff/Principal": p.get("staff_authority_weight", 0.8),
            "Director/VP/Founder": p.get("exec_authority_weight", 1.0)
        }

        # Fetch graph
        nodes = db_conn.execute("SELECT id, full_name, role, company, degree, authority_level FROM nodes WHERE user_id = ?", (user_id,)).fetchall()
        edges = db_conn.execute("SELECT source_id, target_id, weight FROM edges WHERE user_id = ?", (user_id,)).fetchall()

        G = nx.Graph()
        for n in nodes:
            G.add_node(n["id"], **dict(n))

        # Add user-root
        G.add_node(user_id, id=user_id, degree=0)

        for e in edges:
            w = max(0.05, min(0.99, float(e["weight"] or 0.5)))
            cost = -math.log(w)
            G.add_edge(e["source_id"], e["target_id"], weight=cost, prob_weight=w)

        all_targets = [n for n in nodes if n["degree"] >= 2]
        ev_results = []

        for target in all_targets:
            target_id = target["id"]
            if not nx.has_path(G, user_id, target_id):
                continue

            try:
                path = nx.shortest_path(G, user_id, target_id, weight="weight")
                cost = sum(G[path[i]][path[i+1]]["weight"] for i in range(len(path) - 1))
                prob = math.exp(-cost)
                conv_prob = min(0.98, max(0.08, prob))

                auth_tier = target["authority_level"] or "Staff/Principal"
                auth_mult = auth_weights.get(auth_tier, 0.8)

                # Mode boost
                if goal_mode == "infiltration":
                    mode_boost = 1.25 if auth_mult == 1.0 else 0.95
                elif goal_mode == "gravity":
                    mode_boost = 1.15
                else:
                    mode_boost = 1.0

                raw_ev = conv_prob * (0.55 + auth_mult * 0.45) * mode_boost * 100
                ev_score = min(99, max(15, round(raw_ev)))
                ev_results.append({
                    "target_id": target_id,
                    "target_name": target["full_name"],
                    "ev_score": ev_score,
                    "conversion_prob": round(conv_prob * 100, 1),
                    "hops": len(path) - 1
                })
            except Exception:
                continue

        ev_results.sort(key=lambda x: x["ev_score"], reverse=True)
        avg_ev = round(sum(x["ev_score"] for x in ev_results) / max(1, len(ev_results)), 1)
        elapsed = (time.time() - start_time) * 1000

        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=len(ev_results),
            edges_updated=0,
            metrics={
                "goal_mode": goal_mode,
                "targets_evaluated": len(ev_results),
                "average_ev": avg_ev,
                "top_opportunities": ev_results[:5]
            },
            message=f"Computed EV across {len(ev_results)} target nodes (mean EV: {avg_ev}, mode: {goal_mode})."
        )
