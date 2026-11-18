import math
import time
import networkx as nx
from typing import Dict, Any, Optional
from .base import BaseProcessor, ProcessingResult


class CentralityProcessor(BaseProcessor):
    id = "centrality"
    name = "Super-Connector Centrality & PageRank Processor"
    category = "Graph Topology"
    description = "Computes logarithmic-friction Betweenness Centrality C_B(v) and conductance-weighted PageRank, persisting scores into SQLite."
    parameters_schema = {
        "pagerank_damping": {
            "type": "number",
            "default": 0.85,
            "description": "PageRank damping factor (alpha)",
        },
        "normalize_betweenness": {
            "type": "boolean",
            "default": True,
            "description": "Normalize betweenness centrality scores to [0, 1]",
        },
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        alpha = float(p.get("pagerank_damping", 0.85))
        normalized = bool(p.get("normalize_betweenness", True))

        nodes = db_conn.execute(
            "SELECT id, full_name, degree FROM nodes WHERE user_id = ?", (user_id,)
        ).fetchall()
        edges = db_conn.execute(
            "SELECT source_id, target_id, weight FROM edges WHERE user_id = ?", (user_id,)
        ).fetchall()

        G = nx.Graph()
        for n in nodes:
            G.add_node(n["id"], name=n["full_name"], degree=n["degree"])
        for e in edges:
            w = max(0.05, min(0.99, float(e["weight"] or 0.5)))
            cost = -math.log(w)
            G.add_edge(e["source_id"], e["target_id"], weight=w, cost=cost)

        if len(G) == 0:
            return ProcessingResult(
                processor_id=self.id,
                status="skipped",
                execution_time_ms=0.0,
                message="Graph has no nodes.",
            )

        # Betweenness uses distance = cost (-ln w); PageRank uses conductance = weight (w)
        if len(G) > 2 and G.number_of_edges() > 0:
            betweenness = nx.betweenness_centrality(G, weight="cost", normalized=normalized)
        else:
            betweenness = {n: 0.0 for n in G.nodes}

        if G.number_of_edges() > 0:
            try:
                pagerank = nx.pagerank(G, alpha=alpha, weight="weight")
            except Exception:
                pagerank = {n: 1.0 / len(G) for n in G.nodes}
        else:
            pagerank = {n: 1.0 / len(G) for n in G.nodes}

        nodes_updated = 0
        for n in nodes:
            nid = n["id"]
            bc = round(betweenness.get(nid, 0.0), 4)
            pr = round(pagerank.get(nid, 0.0), 4)
            db_conn.execute(
                "UPDATE nodes SET betweenness_centrality = ?, pagerank = ? WHERE id = ?",
                (bc, pr, nid),
            )
            nodes_updated += 1

        db_conn.commit()

        first_deg_nodes = [n for n in nodes if n["degree"] == 1]
        top_bridges = sorted(
            [
                {
                    "id": n["id"],
                    "name": n["full_name"],
                    "betweenness": round(betweenness.get(n["id"], 0.0), 4),
                    "pagerank": round(pagerank.get(n["id"], 0.0), 4),
                }
                for n in first_deg_nodes
            ],
            key=lambda x: (x["betweenness"], x["pagerank"]),
            reverse=True,
        )

        elapsed = (time.time() - start_time) * 1000
        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=nodes_updated,
            edges_updated=0,
            metrics={
                "graph_nodes": len(G.nodes),
                "graph_edges": len(G.edges),
                "top_super_connectors": top_bridges[:5],
                "avg_betweenness": round(sum(betweenness.values()) / max(1, len(betweenness)), 4),
            },
            message=f"Persisted log-cost Betweenness Centrality and PageRank across {nodes_updated} nodes.",
        )
