import math
import time
import networkx as nx
from typing import Dict, Any, Optional
from .base import BaseProcessor, ProcessingResult


class DeltaEVProcessor(BaseProcessor):
    id = "delta_ev"
    name = "Delta-EV Bridge Conditioning Processor"
    category = "Leverage Analysis"
    description = "Uses reverse-Dijkstra O(1) marginal lookup to rank 1st-degree bridges by total network EV unlocked when strengthened."
    parameters_schema = {
        "trust_boost_step": {
            "type": "number",
            "default": 0.25,
            "description": "Hypothetical trust increase applied during conditioning simulation",
        },
        "max_clamped_trust": {
            "type": "number",
            "default": 0.98,
            "description": "Ceiling for boosted trust",
        },
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        step = float(p.get("trust_boost_step", 0.25))
        max_trust = float(p.get("max_clamped_trust", 0.98))

        root_id = f"{user_id}_root"
        nodes = db_conn.execute(
            "SELECT id, full_name, company, degree, trust_score, authority_level FROM nodes WHERE user_id = ?",
            (user_id,),
        ).fetchall()
        edges = db_conn.execute(
            "SELECT source_id, target_id, weight FROM edges WHERE user_id = ?",
            (user_id,),
        ).fetchall()

        first_deg = [n for n in nodes if n["degree"] == 1]
        targets = [n for n in nodes if n["degree"] >= 2]

        # Build subgraph WITHOUT root_id so we can precompute exact shortest distance from each target to each 1st-deg bridge!
        G_full = nx.Graph()
        G_no_root = nx.Graph()
        G_full.add_node(root_id)

        for n in nodes:
            G_full.add_node(n["id"])
            if n["id"] != root_id:
                G_no_root.add_node(n["id"])

        for e in edges:
            src = root_id if e["source_id"] == user_id else e["source_id"]
            tgt = root_id if e["target_id"] == user_id else e["target_id"]
            w = max(0.05, min(0.99, float(e["weight"] or 0.5)))
            cost = -math.log(w)
            G_full.add_edge(src, tgt, weight=cost)
            if src != root_id and tgt != root_id:
                G_no_root.add_edge(src, tgt, weight=cost)

        baseline_lengths = nx.single_source_dijkstra_path_length(G_full, root_id, weight="weight") if root_id in G_full else {}

        auth_map = {"IC": 0.5, "Staff/Principal": 0.8, "Director/VP/Founder": 1.0}

        def cost_to_ev(c: float, auth_level: str) -> int:
            prob = math.exp(-c)
            auth_mult = auth_map.get(auth_level or "Staff/Principal", 0.8)
            return min(99, max(15, round(prob * (0.55 + auth_mult * 0.45) * 100)))

        # Precompute distance from each target to all bridges in G_no_root
        target_to_bridge_dist: Dict[str, Dict[str, float]] = {}
        baseline_ev_per_target: Dict[str, int] = {}

        for t in targets:
            tid = t["id"]
            if tid in G_no_root:
                target_to_bridge_dist[tid] = nx.single_source_dijkstra_path_length(G_no_root, tid, weight="weight")
            else:
                target_to_bridge_dist[tid] = {}

            if tid in baseline_lengths:
                baseline_ev_per_target[tid] = cost_to_ev(baseline_lengths[tid], t["authority_level"])
            else:
                baseline_ev_per_target[tid] = 0

        baseline_total_ev = sum(baseline_ev_per_target.values())
        bridge_rankings = []

        for b in first_deg:
            bid = b["id"]
            curr_trust = max(0.05, min(0.99, float(b["trust_score"] or 0.5)))
            boosted = min(max_trust, round(curr_trust + step, 2))
            new_root_edge_cost = -math.log(boosted)

            sim_total_ev = 0
            unlocked_count = 0
            for t in targets:
                tid = t["id"]
                base_c = baseline_lengths.get(tid, float("inf"))
                dist_b_to_t = target_to_bridge_dist[tid].get(bid, float("inf"))
                via_b_cost = new_root_edge_cost + dist_b_to_t
                best_cost = min(base_c, via_b_cost)
                if best_cost < float("inf"):
                    ev_val = cost_to_ev(best_cost, t["authority_level"])
                    sim_total_ev += ev_val
                    if dist_b_to_t < float("inf"):
                        unlocked_count += 1

            delta = max(0, sim_total_ev - baseline_total_ev)
            bridge_rankings.append(
                {
                    "bridge_id": bid,
                    "name": b["full_name"],
                    "company": b["company"],
                    "current_trust": curr_trust,
                    "boosted_trust": boosted,
                    "delta_ev": delta,
                    "reachable_targets": unlocked_count,
                    "simulated_total_ev": sim_total_ev,
                }
            )

        bridge_rankings.sort(key=lambda x: (x["delta_ev"], x["reachable_targets"], x["current_trust"]), reverse=True)
        elapsed = (time.time() - start_time) * 1000
        top_delta = bridge_rankings[0]["delta_ev"] if bridge_rankings else 0

        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=len(first_deg),
            edges_updated=0,
            metrics={
                "baseline_network_ev": baseline_total_ev,
                "bridges_evaluated": len(first_deg),
                "top_leverage_bridge": bridge_rankings[0] if bridge_rankings else None,
                "all_rankings": bridge_rankings[:15],
            },
            message=f"Simulated O(1) reverse-Dijkstra ΔEV across {len(first_deg)} bridges (max gain: +{top_delta} EV).",
        )
