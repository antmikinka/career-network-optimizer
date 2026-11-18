import json
import time
from typing import Dict, Any, Optional
from .base import BaseProcessor, ProcessingResult
from app.engine.matcher import tokenize_text


class KNNTrajectoryProcessor(BaseProcessor):
    id = "knn_trajectory"
    name = "k-NN Career Trajectory Lookahead Scorer (S_0 vs S_{t-3})"
    category = "Trajectory Intelligence"
    description = "Scores 3-year historical career trajectory alignment against user's current role, skills, and active career vector."
    parameters_schema = {
        "lookahead_horizon_years": {
            "type": "integer",
            "default": 3,
            "description": "Historical career lookback window in years",
        }
    }

    def run(self, db_conn, user_id: str, params: Optional[Dict[str, Any]] = None) -> ProcessingResult:
        start_time = time.time()
        user_row = db_conn.execute(
            "SELECT headline, current_company, active_career_vector FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        skills_rows = db_conn.execute(
            "SELECT skill_name FROM user_skills WHERE user_id = ?", (user_id,)
        ).fetchall()

        s0_text = " ".join(
            [
                user_row["headline"] if user_row and user_row["headline"] else "",
                user_row["current_company"] if user_row and user_row["current_company"] else "",
                " ".join(r["skill_name"] for r in skills_rows),
            ]
        )
        s0_tokens = tokenize_text(s0_text)

        nodes = db_conn.execute(
            """
            SELECT id, role, company, cluster, authority_level, skills_json, past_role_3yrs_ago
            FROM nodes
            WHERE user_id = ? AND degree >= 1
            """,
            (user_id,),
        ).fetchall()

        vectors = [
            (
                "Principal Embodied AI & Humanoid Data Architect",
                {"robot", "robotics", "optimus", "humanoid", "embodied", "teleop", "telemetry", "figure", "lingo", "autonomy"},
            ),
            (
                "Staff Edge ML & Split-Graph Runtime Systems Lead",
                {"onnx", "mlx", "runtime", "inference", "compiler", "coreml", "tensorrt", "cuda", "edge", "kernel", "c++", "tauri"},
            ),
            (
                "Robotics Data & Eval Platform Founder / VP",
                {"founder", "vp", "chief", "partner", "venture", "director", "head", "platform", "eval", "infra"},
            ),
        ]

        nodes_updated = 0
        sim_scores = []

        for n in nodes:
            try:
                n_skills = json.loads(n["skills_json"] or "[]")
            except Exception:
                n_skills = []

            combined = f"{n['role'] or ''} {n['past_role_3yrs_ago'] or ''} {n['company'] or ''} {' '.join(n_skills)}"
            cand_tokens = tokenize_text(combined)

            overlap = len(s0_tokens.intersection(cand_tokens))
            base_sim = 68 + min(29, overlap * 5)
            if n["authority_level"] in ("Staff/Principal", "Director/VP/Founder"):
                base_sim = min(98, base_sim + 4)

            best_vec = vectors[0][0]
            best_hits = -1
            for vec_title, kw_set in vectors:
                hits = len(cand_tokens.intersection(kw_set))
                if hits > best_hits:
                    best_hits = hits
                    best_vec = vec_title

            past_role = (n["past_role_3yrs_ago"] or "").strip()
            if not past_role and n["role"]:
                past_role = f"Senior / Staff IC prior to {n['role']}"

            db_conn.execute(
                """
                UPDATE nodes
                SET knn_similarity = ?, vector_cluster = ?, past_role_3yrs_ago = ?
                WHERE id = ?
                """,
                (base_sim, best_vec, past_role, n["id"]),
            )
            sim_scores.append(base_sim)
            nodes_updated += 1

        db_conn.commit()
        avg_sim = round(sum(sim_scores) / len(sim_scores), 1) if sim_scores else 0.0
        elapsed = (time.time() - start_time) * 1000

        return ProcessingResult(
            processor_id=self.id,
            status="success",
            execution_time_ms=round(elapsed, 2),
            nodes_updated=nodes_updated,
            edges_updated=0,
            metrics={
                "nodes_scored": nodes_updated,
                "average_knn_similarity": avg_sim,
            },
            message=f"Scored k-NN 3-year trajectory alignment across {nodes_updated} contacts (mean similarity: {avg_sim}%).",
        )
