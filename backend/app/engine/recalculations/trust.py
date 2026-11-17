import math
import time
from typing import Dict, Any, Optional
from datetime import datetime
from .base import BaseProcessor, ProcessingResult

class TrustRecalculator(BaseProcessor):
    id = "trust"
    name = "Connection Trust & Interaction Recalculator"
    category = "Edge Scoring"
    description = "Recalculates 1st-degree trust scores based on message volume, interaction recency half-life, and coworker tenure overlap."
    parameters_schema = {
        "half_life_days": {
            "type": "integer",
            "default": 180,
            "description": "Days for interaction recency weight to decay by half"
        },
        "coworker_bonus": {
            "type": "number",
            "default": 0.15,
            "description": "Bonus weight added if company overlap is detected"
        },
        "min_trust": {
            "type": "number",
            "default": 0.15,
            "description": "Floor threshold for trust score"
        },
        "max_trust": {
            "type": "number",
            "default": 0.98,
            "description": "Ceiling threshold for trust score"
        }
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        half_life = p.get("half_life_days", 180)
        coworker_bonus = p.get("coworker_bonus", 0.15)
        min_trust = p.get("min_trust", 0.15)
        max_trust = p.get("max_trust", 0.98)
        lambda_decay = math.log(2) / max(1, half_life)

        # Get user company
        user_row = db_conn.execute("SELECT current_company FROM users WHERE id = ?", (user_id,)).fetchone()
        user_company = (user_row["current_company"] or "").lower() if user_row else ""

        # Fetch 1st degree nodes
        nodes = db_conn.execute(
            "SELECT id, company, message_count, connected_on, last_interaction_at FROM nodes WHERE user_id = ? AND degree = 1",
            (user_id,)
        ).fetchall()

        now = datetime.now()
        nodes_updated = 0
        edges_updated = 0
        trust_scores = []

        for node in nodes:
            msg_count = node["message_count"] or 0
            company = (node["company"] or "").lower()
            is_coworker = bool(user_company and company and user_company == company)

            # Recency calculation
            date_str = node["last_interaction_at"] or node["connected_on"]
            days_since = 60
            if date_str:
                try:
                    dt = datetime.strptime(str(date_str).split("T")[0], "%Y-%m-%d")
                    days_since = max(0, (now - dt).days)
                except Exception:
                    days_since = 60

            msg_term = 0.35 * (math.log(1 + max(0, msg_count)) / math.log(50))
            recency_term = 0.25 * math.exp(-lambda_decay * days_since)
            bonus = coworker_bonus if is_coworker else 0.0

            raw_trust = 0.25 + msg_term + recency_term + bonus
            clamped_trust = round(min(max_trust, max(min_trust, raw_trust)), 3)
            trust_scores.append(clamped_trust)

            db_conn.execute(
                "UPDATE nodes SET trust_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (clamped_trust, node["id"])
            )
            nodes_updated += 1

            # Update corresponding direct edge
            cursor = db_conn.execute(
                """UPDATE edges SET weight = ? WHERE user_id = ? AND 
                   ((source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?))""",
                (clamped_trust, user_id, user_id, node["id"], node["id"], user_id)
            )
            edges_updated += cursor.rowcount

        db_conn.commit()
        avg_trust = round(sum(trust_scores) / len(trust_scores), 3) if trust_scores else 0.0
        elapsed = (time.time() - start_time) * 1000

        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=nodes_updated,
            edges_updated=edges_updated,
            metrics={
                "nodes_evaluated": len(nodes),
                "average_trust": avg_trust,
                "half_life_used": half_life
            },
            message=f"Recalculated trust for {nodes_updated} 1st-degree contacts (mean trust: {avg_trust})."
        )
