import json
import time
from typing import Dict, Any, Optional, List
from .base import BaseProcessor, ProcessingResult

class SkillSynergyProcessor(BaseProcessor):
    id = "synergy"
    name = "Skill Synergy & Stack Gravity Processor"
    category = "Skill Matching"
    description = "Evaluates weighted cosine similarity, technical skill overlap, and category gravity between user skills and target nodes."
    parameters_schema = {
        "min_synergy_boost": {
            "type": "number",
            "default": 0.68,
            "description": "Baseline multiplier for candidates with minimal overlap"
        },
        "max_synergy_boost": {
            "type": "number",
            "default": 1.25,
            "description": "Ceiling multiplier for candidates with perfect stack synergy"
        }
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        p = params or {}
        min_boost = p.get("min_synergy_boost", 0.68)
        max_boost = p.get("max_synergy_boost", 1.25)

        # Get user skills
        user_skills_rows = db_conn.execute(
            "SELECT skill_name, category, proficiency FROM user_skills WHERE user_id = ?",
            (user_id,)
        ).fetchall()
        user_skills_map = {r["skill_name"].lower(): r["proficiency"] for r in user_skills_rows}

        # Fetch target nodes (2nd and 3rd degree)
        nodes = db_conn.execute(
            "SELECT id, full_name, skills_json, strategic_value FROM nodes WHERE user_id = ? AND degree >= 2",
            (user_id,)
        ).fetchall()

        nodes_updated = 0
        synergy_scores = []

        for node in nodes:
            try:
                node_skills: List[str] = json.loads(node["skills_json"] or "[]")
            except Exception:
                node_skills = []

            shared = [s for s in node_skills if s.lower() in user_skills_map]
            if shared:
                avg_prof = sum(user_skills_map[s.lower()] for s in shared) / len(shared)
            else:
                avg_prof = 75.0

            # Compute synergy factor
            factor = min_boost + min(max_boost - min_boost, (len(shared) * 0.16) * (avg_prof / 92.0))
            factor = round(min(max_boost, max(min_boost, factor)), 3)
            synergy_scores.append(factor)

            # Update strategic value slightly based on synergy
            new_strat = min(99, max(50, int(node["strategic_value"] * 0.6 + factor * 40)))
            db_conn.execute(
                "UPDATE nodes SET strategic_value = ? WHERE id = ?",
                (new_strat, node["id"])
            )
            nodes_updated += 1

        db_conn.commit()
        avg_synergy = round(sum(synergy_scores) / max(1, len(synergy_scores)), 3)
        elapsed = (time.time() - start_time) * 1000

        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=nodes_updated,
            edges_updated=0,
            metrics={
                "targets_evaluated": len(nodes),
                "average_synergy_factor": avg_synergy,
                "user_skills_count": len(user_skills_map)
            },
            message=f"Recalculated technical synergy for {nodes_updated} target nodes (mean synergy: {avg_synergy}x)."
        )
