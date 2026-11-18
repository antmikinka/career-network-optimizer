import re
import json
import sqlite3
from typing import Dict, List, Any, Optional
from app.seed import ensure_user_profile

SKILL_CATALOG = {
    "Core": [
        "Python", "C++", "C++ & Tauri GUI Systems", "Rust", "Go", "PyTorch",
        "TypeScript", "SQL", "CUDA", "Automated Test Execution / Loom", "React",
    ],
    "Systems": [
        "ONNX Runtime & Graph Chunking", "MLX Inference Acceleration",
        "Distributed Systems", "Kafka", "Kubernetes", "Low-Latency Networking",
        "GPU Cluster Orchestration", "Ray", "Triton", "Docker",
    ],
    "Domain": [
        "Humanoid Robotics Telemetry & Data Ops", "Vision-Language-Action (VLA)",
        "Kinematics Teleoperation", "Autonomous Fleet Telemetry",
        "Synthetic Data Generation", "Hardware-in-the-Loop (HIL)",
    ],
    "Leadership": [
        "Distributed Data Platform Architecture", "Technical Roadmap Strategy",
        "Cross-Functional Architecture", "System Design Reviews", "Engineering Mentorship",
    ],
}


def parse_resume_text(text: str) -> Dict[str, Any]:
    """Extracts categorized technical competencies and company history from resume text."""
    text_lower = text.lower()
    detected_skills: List[Dict[str, Any]] = []
    seen = set()

    keyword_aliases = {
        "onnx": ("ONNX Runtime & Graph Chunking", "Systems", 95),
        "mlx": ("MLX Inference Acceleration", "Systems", 92),
        "tauri": ("C++ & Tauri GUI Systems", "Core", 90),
        "optimus": ("Humanoid Robotics Telemetry & Data Ops", "Domain", 94),
        "lingo": ("Distributed Data Platform Architecture", "Leadership", 90),
        "loom": ("Automated Test Execution / Loom", "Core", 88),
    }

    for kw, (sname, cat, prof) in keyword_aliases.items():
        if kw in text_lower and sname.lower() not in seen:
            seen.add(sname.lower())
            detected_skills.append({"skill_name": sname, "category": cat, "proficiency": prof})

    for category, skills in SKILL_CATALOG.items():
        for skill in skills:
            pattern = r"\b" + re.escape(skill.lower()) + r"\b"
            if re.search(pattern, text_lower) or skill.lower() in text_lower:
                if skill.lower() not in seen:
                    seen.add(skill.lower())
                    proficiency = 90 if category in ("Core", "Domain", "Systems") else 86
                    detected_skills.append(
                        {"skill_name": skill, "category": category, "proficiency": proficiency}
                    )

    known_companies = [
        "Tesla", "Apple", "Figure", "OpenAI", "NVIDIA", "Anthropic",
        "Google", "Meta", "Amazon", "Microsoft",
    ]
    matched_companies = [c for c in known_companies if c.lower() in text_lower]

    return {
        "skills": detected_skills,
        "matched_companies": matched_companies,
        "raw_length": len(text),
    }


def ingest_resume_into_db(
    conn: sqlite3.Connection,
    user_id: str,
    resume_text: str,
    full_name: Optional[str] = None,
    headline: Optional[str] = None,
    target_roles: Optional[List[str]] = None,
    target_companies: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Updates user profile and upserts detected technical skills into SQLite."""
    ensure_user_profile(conn, user_id)
    parsed = parse_resume_text(resume_text)

    user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    current_companies = json.loads(user_row["target_companies_json"] or "[]")
    current_roles = json.loads(user_row["target_roles_json"] or "[]")

    final_companies = target_companies if target_companies is not None else current_companies
    final_roles = target_roles if target_roles is not None else current_roles
    final_name = full_name or user_row["full_name"]
    final_headline = headline or user_row["headline"]
    final_company = (
        parsed["matched_companies"][0]
        if parsed["matched_companies"]
        else (user_row["current_company"] or "Tesla")
    )

    conn.execute(
        """
        UPDATE users
        SET full_name = ?, headline = ?, current_company = ?,
            target_roles_json = ?, target_companies_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            final_name,
            final_headline,
            final_company,
            json.dumps(final_roles),
            json.dumps(final_companies),
            user_id,
        ),
    )

    for s in parsed["skills"]:
        conn.execute(
            """
            INSERT INTO user_skills (user_id, skill_name, category, proficiency)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, skill_name) DO UPDATE SET
                category = excluded.category,
                proficiency = excluded.proficiency
            """,
            (user_id, s["skill_name"], s["category"], s["proficiency"]),
        )

    conn.commit()
    return {
        "user_id": user_id,
        "skills_saved": len(parsed["skills"]),
        "skills": parsed["skills"],
    }
