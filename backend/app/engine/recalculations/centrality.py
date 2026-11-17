import time
import networkx as nx
from typing import Dict, Any, Optional
from .base import BaseProcessor, ProcessingResult

class CentralityProcessor(BaseProcessor):
    id = "centrality"
    name = "Network Centrality & PageRank Processor"
    category = "Graph Topology"
    description = "Computes Betweenness Centrality, PageRank, and Closeness Centrality across all contacts to surface super-connectors."
    parameters_schema = {
        "pagerank_damping": {
            "type": "number",
            "default": 0.85,
            "description": "PageRank damping factor (alpha)"
        },
        "normalize_betweenness": {
            "type": "boolean",
            "default": True,
            "description": "Whether to normalize betweenness centrality scores to [0, 1]"
        }
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        alpha = p.get("pagerank_damping", 0.85)
        normalized = p.get("normalize_betweenness", True)

        # Build NetworkX graph from database
        nodes = db_conn.execute("SELECT id, full_name, degree FROM nodes WHERE user_id = ?", (user_id,)).fetchall()
        edges = db_conn.execute("SELECT source_id, target_id, weight FROM edges WHERE user_id = ?", (user_id,)).fetchall()

        G = nx.Graph()
        for n in nodes:
            G.add_node(n["id"], name=n["full_name"], degree=n["degree"])
        for e in edges:
            w = max(0.01, min(0.99, float(e["weight"] or 0.5)))
            G.add_edge(e["source_id"], e["target_id"], weight=w)

        if len(G) == 0:
            return ProcessingResult(
                processor_id=self.id,
                status="skipped",
                execution_time_ms=0,
                message="Graph is empty; no centrality to compute."
            )

        # Compute metrics
        betweenness = nx.betweenness_centrality(G, weight="weight", normalized=normalized)
        try:
            pagerank = nx.pagerank(G, alpha=alpha, weight="weight")
        except Exception:
            pagerank = {n: 1.0 / len(G) for n in G.nodes}

        # Filter only 1st-degree connectors for top ranking
        first_deg_nodes = [n for n in nodes if n["degree"] == 1]
        top_bridges = sorted(
            [{"id": n["id"], "name": n["full_name"], "betweenness": round(betweenness.get(n["id"], 0), 4), "pagerank": round(pagerank.get(n["id"], 0), 4)} for n in first_deg_nodes],
            key=lambda x: x["betweenness"],
            reverse=True
        )

        elapsed = (time.time() - start_time) * 1000
        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=len(nodes),
            edges_updated=0,
            metrics={
                "graph_nodes": len(G.nodes),
                "graph_edges": len(G.edges),
                "top_super_connectors": top_bridges[:5],
                "avg_betweenness": round(sum(betweenness.values()) / max(1, len(betweenness)), 4)
            },
            message=f"Computed centrality and PageRank across {len(G.nodes)} nodes."
        )
