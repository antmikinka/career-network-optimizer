import json
import math
import time
from typing import Dict, Any, Optional, List
from .base import BaseProcessor, ProcessingResult
from app.engine.matcher import tokenize_text


class SkillSynergyProcessor(BaseProcessor):
    id = "synergy"
    name = "Skill Synergy & Stack Gravity Processor"
    category = "Skill Matching"
    description = "Computes weighted cosine and token-overlap technical synergy between user competencies and all contact nodes."
    parameters_schema = {
        "min_synergy_boost": {
            "type": "number",
            "default": 0.68,
            "description": "Baseline multiplier for candidates with minimal overlap",
        },
        "max_synergy_boost": {
            "type": "number",
            "default": 1.25,
            "description": "Ceiling multiplier for candidates with high stack synergy",
        },
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        min_boost = float(p.get("min_synergy_boost", 0.68))
        max_boost = float(p.get("max_synergy_boost", 1.25))

        user_row = db_conn.execute(
            "SELECT target_companies_json FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        target_companies = {
            c.lower().strip()
            for c in json.loads(user_row["target_companies_json"] or "[]")
        } if user_row else set()

        user_skills_rows = db_conn.execute(
            "SELECT skill_name, category, proficiency FROM user_skills WHERE user_id = ?",
            (user_id,),
        ).fetchall()

        user_skills_map = {r["skill_name"].lower(): float(r["proficiency"] or 85) for r in user_skills_rows}
        user_tokens = set()
        for s_name in user_skills_map:
            user_tokens.update(tokenize_text(s_name))

        nodes = db_conn.execute(
            """
            SELECT id, full_name, role, company, degree, authority_level, skills_json, strategic_value
            FROM nodes
            WHERE user_id = ? AND degree >= 1
            """,
            (user_id,),
        ).fetchall()

        nodes_updated = 0
        synergy_scores = []

        for node in nodes:
            try:
                node_skills: List[str] = json.loads(node["skills_json"] or "[]")
            except Exception:
                node_skills = []

            exact_shared = [s for s in node_skills if s.lower() in user_skills_map]
            node_tokens = tokenize_text(" ".join(node_skills) + " " + (node["role"] or ""))
            token_overlap = len(user_tokens.intersection(node_tokens)) / max(1.0, math.sqrt(len(user_tokens) * max(1, len(node_tokens))))

            if exact_shared:
                avg_prof = sum(user_skills_map[s.lower()] for s in exact_shared) / len(exact_shared)
                raw_factor = min_boost + min(max_boost - min_boost, (len(exact_shared) * 0.16) * (avg_prof / 92.0) + token_overlap * 0.15)
            else:
                raw_factor = min_boost + min(max_boost - min_boost, token_overlap * 0.45)

            factor = round(min(max_boost, max(min_boost, raw_factor)), 3)
            synergy_scores.append(factor)

            company_lower = (node["company"] or "").lower().strip()
            is_target_org = any(tc in company_lower or company_lower in tc for tc in target_companies if tc)
            auth = node["authority_level"] or "Staff/Principal"
            auth_pts = 22 if auth == "Director/VP/Founder" else 14 if auth == "Staff/Principal" else 6
            org_pts = 28 if is_target_org else 10
            synergy_pts = int(((factor - min_boost) / max(0.01, max_boost - min_boost)) * 45)

            new_strat = min(99, max(35, 15 + auth_pts + org_pts + synergy_pts))
            db_conn.execute(
                "UPDATE nodes SET strategic_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_strat, node["id"]),
            )
            nodes_updated += 1

        db_conn.commit()
        avg_synergy = round(sum(synergy_scores) / max(1, len(synergy_scores)), 3) if synergy_scores else 0.0
        elapsed = (time.time() - start_time) * 1000

        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=nodes_updated,
            edges_updated=0,
            metrics={
                "contacts_evaluated": len(nodes),
                "average_synergy_factor": avg_synergy,
                "user_skills_count": len(user_skills_map),
            },
            message=f"Recalculated technical synergy & strategic value across {nodes_updated} contacts (mean synergy: {avg_synergy}x).",
        )
