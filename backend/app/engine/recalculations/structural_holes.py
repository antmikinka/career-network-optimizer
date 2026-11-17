import time
from typing import Dict, Any, Optional
from collections import defaultdict
from .base import BaseProcessor, ProcessingResult

class StructuralHolesProcessor(BaseProcessor):
    id = "structural_holes"
    name = "Ronald Burt Structural Holes & Modularity Processor"
    category = "Network Topology"
    description = "Calculates network constraint, bridging capital, and the Burt Opportunity Index across network clusters."
    parameters_schema = {
        "target_density_weight": {
            "type": "number",
            "default": 22.0,
            "description": "Multiplier weighting 2nd/3rd degree target density in underrepresented clusters"
        },
        "cross_bridge_weight": {
            "type": "number",
            "default": 4.0,
            "description": "Bonus points per cross-cluster relationship bridge"
        }
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        td_weight = p.get("target_density_weight", 22.0)
        cb_weight = p.get("cross_bridge_weight", 4.0)

        # Get nodes and their clusters
        nodes = db_conn.execute("SELECT id, cluster, degree FROM nodes WHERE user_id = ?", (user_id,)).fetchall()
        edges = db_conn.execute("SELECT source_id, target_id FROM edges WHERE user_id = ?", (user_id,)).fetchall()

        cluster_map = defaultdict(lambda: {"1st": 0, "targets": 0, "nodes": set()})
        for n in nodes:
            c = n["cluster"] or "General"
            cluster_map[c]["nodes"].add(n["id"])
            if n["degree"] == 1:
                cluster_map[c]["1st"] += 1
            elif n["degree"] >= 2:
                cluster_map[c]["targets"] += 1

        # Count cross cluster edges
        node_to_cluster = {n["id"]: (n["cluster"] or "General") for n in nodes}
        cross_edges = defaultdict(int)

        for e in edges:
            if e["source_id"] == user_id or e["target_id"] == user_id:
                continue
            c1 = node_to_cluster.get(e["source_id"])
            c2 = node_to_cluster.get(e["target_id"])
            if c1 and c2 and c1 != c2:
                cross_edges[c1] += 1
                cross_edges[c2] += 1

        cluster_metrics = []
        for c, data in cluster_map.items():
            first_deg = max(0.7, data["1st"])
            targets = data["targets"]
            external = cross_edges[c]
            hole_score = min(98, round((targets * td_weight) / first_deg + external * cb_weight))
            cluster_metrics.append({
                "cluster": c,
                "first_degree_bridges": data["1st"],
                "target_count": targets,
                "external_bridges": external,
                "hole_opportunity_score": hole_score,
                "is_structural_hole": data["1st"] == 0
            })

        cluster_metrics.sort(key=lambda x: x["hole_opportunity_score"], reverse=True)
        elapsed = (time.time() - start_time) * 1000

        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=len(nodes),
            edges_updated=0,
            metrics={
                "clusters_analyzed": len(cluster_metrics),
                "clusters": cluster_metrics,
                "top_opportunity_cluster": cluster_metrics[0]["cluster"] if cluster_metrics else "None"
            },
            message=f"Evaluated structural holes across {len(cluster_metrics)} clusters."
        )
