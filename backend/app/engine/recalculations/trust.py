import math
import time
from typing import Dict, Any, Optional
from datetime import datetime
from .base import BaseProcessor, ProcessingResult


class TrustRecalculator(BaseProcessor):
    id = "trust"
    name = "Connection Trust & Interaction Recalculator"
    category = "Edge Scoring"
    description = "Recalculates 1st-degree trust scores and direct edge weights from message volume, interaction half-life decay, and coworker overlap."
    parameters_schema = {
        "half_life_days": {
            "type": "integer",
            "default": 180,
            "description": "Days for interaction recency weight to decay by half",
        },
        "coworker_bonus": {
            "type": "number",
            "default": 0.15,
            "description": "Bonus weight added when company overlap is detected",
        },
        "min_trust": {
            "type": "number",
            "default": 0.15,
            "description": "Floor threshold for trust score",
        },
        "max_trust": {
            "type": "number",
            "default": 0.98,
            "description": "Ceiling threshold for trust score",
        },
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        half_life = max(1, int(p.get("half_life_days", 180)))
        coworker_bonus = float(p.get("coworker_bonus", 0.15))
        min_trust = float(p.get("min_trust", 0.15))
        max_trust = float(p.get("max_trust", 0.98))
        lambda_decay = math.log(2) / half_life

        root_id = f"{user_id}_root"
        user_row = db_conn.execute("SELECT current_company FROM users WHERE id = ?", (user_id,)).fetchone()
        user_company = (user_row["current_company"] or "").strip().lower() if user_row else ""

        nodes = db_conn.execute(
            """
            SELECT id, company, message_count, connected_on, last_interaction_at, trust_score
            FROM nodes
            WHERE user_id = ? AND degree = 1
            """,
            (user_id,),
        ).fetchall()

        now = datetime.now()
        nodes_updated = 0
        edges_updated = 0
        trust_scores = []

        for node in nodes:
            msg_count = int(node["message_count"] or 0)
            company = (node["company"] or "").strip().lower()
            is_coworker = bool(user_company and company and (user_company in company or company in user_company))

            date_str = (node["last_interaction_at"] or node["connected_on"] or "").strip()
            days_since = 90
            if date_str:
                for fmt in ("%Y-%m-%d", "%d %b %Y", "%m/%d/%Y"):
                    try:
                        clean = str(date_str).split("T")[0].strip()
                        dt = datetime.strptime(clean, fmt)
                        days_since = max(0, (now - dt).days)
                        break
                    except Exception:
                        continue

            msg_term = 0.35 * (math.log(1 + max(0, msg_count)) / math.log(50))
            recency_term = 0.25 * math.exp(-lambda_decay * days_since)
            bonus = coworker_bonus if is_coworker else 0.0

            computed_trust = 0.25 + msg_term + recency_term + bonus
            # Blend smoothly if user has zero archived DMs so manual overrides aren't wiped blindly unless msg/date exists
            if msg_count == 0 and not date_str and node["trust_score"]:
                raw_trust = 0.65 * float(node["trust_score"]) + 0.35 * computed_trust
            else:
                raw_trust = computed_trust

            clamped_trust = round(min(max_trust, max(min_trust, raw_trust)), 2)
            trust_scores.append(clamped_trust)

            db_conn.execute(
                "UPDATE nodes SET trust_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (clamped_trust, node["id"]),
            )
            nodes_updated += 1

            cursor = db_conn.execute(
                """
                UPDATE edges SET weight = ?
                WHERE user_id = ? AND (
                    (source_id = ? AND target_id = ?) OR
                    (source_id = ? AND target_id = ?)
                )
                """,
                (clamped_trust, user_id, root_id, node["id"], node["id"], root_id),
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
                "edges_reweighted": edges_updated,
                "average_trust": avg_trust,
                "half_life_used": half_life,
            },
            message=f"Recalculated trust across {nodes_updated} 1st-degree nodes and {edges_updated} root edges (mean trust: {avg_trust}).",
        )
