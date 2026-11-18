import time
from typing import Dict, Any, Optional
from .base import BaseProcessor, ProcessingResult


class CompanyBridgeSynthesizer(BaseProcessor):
    id = "bridge_synthesis"
    name = "Insider & Colleague Overlap Bridge Synthesizer"
    category = "Topology Inference"
    description = "Discovers and wires real insider bridge edges between 1st-degree contacts and 2nd/3rd-degree targets sharing organizations or clusters (zero synthetic nodes)."
    parameters_schema = {
        "same_company_weight": {
            "type": "number",
            "default": 0.78,
            "description": "Edge weight assigned when a 1st-degree contact works at the exact same company as a 2nd/3rd-degree target",
        },
        "min_bridge_trust": {
            "type": "number",
            "default": 0.25,
            "description": "Minimum 1st-degree trust required before wiring automated insider bridges",
        },
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        base_bridge_w = float(p.get("same_company_weight", 0.78))
        min_trust = float(p.get("min_bridge_trust", 0.25))

        first_deg = db_conn.execute(
            "SELECT id, full_name, company, cluster, trust_score FROM nodes WHERE user_id = ? AND degree = 1",
            (user_id,),
        ).fetchall()
        targets = db_conn.execute(
            "SELECT id, full_name, company, cluster, degree FROM nodes WHERE user_id = ? AND degree >= 2",
            (user_id,),
        ).fetchall()

        existing_pairs = set()
        for e in db_conn.execute("SELECT source_id, target_id FROM edges WHERE user_id = ?", (user_id,)).fetchall():
            existing_pairs.add((e["source_id"], e["target_id"]))
            existing_pairs.add((e["target_id"], e["source_id"]))

        edges_created = 0
        for b in first_deg:
            b_trust = float(b["trust_score"] or 0.5)
            if b_trust < min_trust:
                continue
            b_co = (b["company"] or "").strip().lower()
            if not b_co or b_co in ("independent", "stealth", "unknown", "self"):
                continue

            for t in targets:
                if (b["id"], t["id"]) in existing_pairs:
                    continue
                t_co = (t["company"] or "").strip().lower()
                if not t_co:
                    continue

                if b_co == t_co or (len(b_co) >= 4 and (b_co in t_co or t_co in b_co)):
                    inferred_weight = round(min(0.90, max(0.50, base_bridge_w * (0.75 + 0.25 * b_trust))), 2)
                    ctx = f"Insider colleague overlap @ {t['company']} via {b['full_name']}"
                    db_conn.execute(
                        """
                        INSERT OR IGNORE INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
                        VALUES (?, ?, ?, ?, 'colleague_overlap', ?)
                        """,
                        (user_id, b["id"], t["id"], inferred_weight, ctx),
                    )
                    existing_pairs.add((b["id"], t["id"]))
                    edges_created += 1

        db_conn.commit()
        elapsed = (time.time() - start_time) * 1000
        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=0,
            edges_updated=edges_created,
            metrics={
                "first_degree_scanned": len(first_deg),
                "targets_scanned": len(targets),
                "new_insider_bridges_wired": edges_created,
            },
            message=f"Synthesized {edges_created} real company-overlap bridge edges across {len(targets)} targets.",
        )
