import time
import math
import networkx as nx
from typing import Dict, Any, Optional
from .base import BaseProcessor, ProcessingResult

class DeltaEVProcessor(BaseProcessor):
    id = "delta_ev"
    name = "Delta-EV Bridge Conditioning Processor"
    category = "Leverage Analysis"
    description = "Simulates boosting each 1st-degree bridge by a configurable trust increment (+0.10, +0.25, etc.) and measures total network EV expansion."
    parameters_schema = {
        "trust_boost_step": {
            "type": "number",
            "default": 0.25,
            "description": "Hypothetical trust increase applied during simulation (e.g., 0.25)"
        },
        "max_clamped_trust": {
            "type": "number",
            "default": 0.98,
            "description": "Ceiling for boosted trust"
        }
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        step = p.get("trust_boost_step", 0.25)
        max_trust = p.get("max_clamped_trust", 0.98)

        # Fetch nodes and edges
        nodes = db_conn.execute("SELECT id, full_name, company, degree, trust_score, authority_level FROM nodes WHERE user_id = ?", (user_id,)).fetchall()
        edges = db_conn.execute("SELECT source_id, target_id, weight FROM edges WHERE user_id = ?", (user_id,)).fetchall()

        first_deg = [n for n in nodes if n["degree"] == 1]
        targets = [n for n in nodes if n["degree"] >= 2]

        def compute_total_ev(edge_list):
            G = nx.Graph()
            G.add_node(user_id)
            for n in nodes:
                G.add_node(n["id"])
            for e in edge_list:
                w = max(0.05, min(0.99, float(e["weight"] or 0.5)))
                cost = -math.log(w)
                G.add_edge(e["source_id"], e["target_id"], weight=cost)

            total_ev = 0
            for t in targets:
                tid = t["id"]
                if nx.has_path(G, user_id, tid):
                    try:
                        cost = nx.shortest_path_length(G, user_id, tid, weight="weight")
                        prob = math.exp(-cost)
                        total_ev += min(99, max(15, round(prob * 100)))
                    except Exception:
                        pass
            return total_ev

        baseline_ev = compute_total_ev(edges)
        bridge_rankings = []

        for b in first_deg:
            bid = b["id"]
            curr_trust = float(b["trust_score"] or 0.5)
            boosted = min(max_trust, round(curr_trust + step, 2))

            # Substitute edge weight
            sim_edges = []
            for e in edges:
                if (e["source_id"] == user_id and e["target_id"] == bid) or (e["target_id"] == user_id and e["source_id"] == bid):
                    sim_edges.append({"source_id": e["source_id"], "target_id": e["target_id"], "weight": boosted})
                else:
                    sim_edges.append(dict(e))

            sim_ev = compute_total_ev(sim_edges)
            delta = max(1, sim_ev - baseline_ev)
            bridge_rankings.append({
                "bridge_id": bid,
                "name": b["full_name"],
                "company": b["company"],
                "current_trust": curr_trust,
                "boosted_trust": boosted,
                "delta_ev": delta,
                "simulated_total_ev": sim_ev
            })

        bridge_rankings.sort(key=lambda x: x["delta_ev"], reverse=True)
        elapsed = (time.time() - start_time) * 1000

        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=len(first_deg),
            edges_updated=0,
            metrics={
                "baseline_network_ev": baseline_ev,
                "bridges_evaluated": len(first_deg),
                "top_leverage_bridge": bridge_rankings[0] if bridge_rankings else None,
                "all_rankings": bridge_rankings
            },
            message=f"Simulated ΔEV conditioning across {len(first_deg)} bridges. Top connector unlocks +{bridge_rankings[0]['delta_ev'] if bridge_rankings else 0} EV."
        )
