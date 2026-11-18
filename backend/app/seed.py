import json
import sqlite3
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import get_db_connection, init_db

DEFAULT_REPOSITORIES = [
    "antmikinka/onnx-model-chunking",
    "antmikinka/lemon-mlx-engine",
    "antmikinka/loom",
    "antmikinka/lemonade",
]

DEFAULT_TARGET_COMPANIES = ["Tesla", "Apple", "Figure", "OpenAI", "Anthropic", "NVIDIA"]

DEFAULT_TARGET_ROLES = [
    "Principal Embodied AI & Humanoid Data Architect",
    "Staff Edge ML & Split-Graph Runtime Systems Lead",
    "Robotics Data & Eval Platform Founder / VP",
    "Director of Robotics Data Infrastructure",
]

DEFAULT_SKILLS = [
    ("ONNX Runtime & Graph Chunking", "Systems", 95),
    ("MLX Inference Acceleration", "Systems", 92),
    ("C++ & Tauri GUI Systems", "Core", 90),
    ("Humanoid Robotics Telemetry & Data Ops", "Domain", 94),
    ("Distributed Data Platform Architecture", "Leadership", 89),
    ("Automated Test Execution / Loom", "Core", 86),
]


def ensure_user_profile(conn: sqlite3.Connection, user_id: str = "default_user") -> None:
    """Ensures user profile & root node exist without deleting existing contacts."""
    existing = conn.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
    if not existing:
        conn.execute(
            """
            INSERT INTO users (
                id, full_name, headline, current_company, location,
                active_goal_mode, active_career_vector,
                repositories_json, target_roles_json, target_companies_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                "Anthony Mikinka",
                "Humanoid Robotics Data Operations & Data Platform Architecture (Tesla Optimus / Lingo)",
                "Tesla",
                "San Jose, CA",
                "trajectory",
                "Principal Embodied AI & Humanoid Data Architect",
                json.dumps(DEFAULT_REPOSITORIES),
                json.dumps(DEFAULT_TARGET_ROLES),
                json.dumps(DEFAULT_TARGET_COMPANIES),
            ),
        )

        for name, cat, prof in DEFAULT_SKILLS:
            conn.execute(
                """
                INSERT OR IGNORE INTO user_skills (user_id, skill_name, category, proficiency)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, name, cat, prof),
            )

    root_id = f"{user_id}_root"
    root_exists = conn.execute("SELECT id FROM nodes WHERE id = ?", (root_id,)).fetchone()
    if not root_exists:
        user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        skills_rows = conn.execute(
            "SELECT skill_name FROM user_skills WHERE user_id = ?", (user_id,)
        ).fetchall()
        skill_names = [r["skill_name"] for r in skills_rows] or [s[0] for s in DEFAULT_SKILLS]

        conn.execute(
            """
            INSERT INTO nodes (
                id, user_id, full_name, role, company, location, degree,
                trust_score, strategic_value, authority_level, cluster,
                skills_json, linkedin_url, notes
            ) VALUES (?, ?, ?, ?, ?, ?, 0, 1.0, 100, 'Staff/Principal', 'Robotics & Embodied AI', ?, ?, ?)
            """,
            (
                root_id,
                user_id,
                user_row["full_name"] if user_row else "Anthony Mikinka",
                user_row["headline"] if user_row else "Humanoid Robotics Data Operations & Data Platform Architecture",
                user_row["current_company"] if user_row else "Tesla",
                user_row["location"] if user_row and user_row["location"] else "San Jose, CA",
                json.dumps(skill_names),
                "https://linkedin.com/in/antmikinka",
                "Root User Profile",
            ),
        )
    conn.commit()


def seed_database(
    conn: Optional[sqlite3.Connection] = None,
    user_id: str = "default_user",
    include_demo_contacts: bool = False,
) -> None:
    """
    Resets database for `user_id` to Anthony Mikinka's clean root profile.
    By default (`include_demo_contacts=False`), zero placeholder contacts or edges exist.
    """
    close_after = False
    if conn is None:
        init_db()
        conn = get_db_connection()
        close_after = True

    try:
        conn.execute("DELETE FROM edges WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM nodes WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM user_skills WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()

        ensure_user_profile(conn, user_id)

        if include_demo_contacts:
            # Isolated fixture used strictly inside automated integration test suite
            root_id = f"{user_id}_root"
            fixture_nodes = [
                ("n_test_bridge_1", "Test Bridge Alpha", "Staff Integration Architect", "Tesla", "Palo Alto, CA", 1, 0.94, 90, "Staff/Principal", "Robotics & Embodied AI", ["Humanoid Robotics Telemetry & Data Ops", "C++ & Tauri GUI Systems"], 42, "Automated test fixture"),
                ("n_test_bridge_2", "Test Bridge Beta", "Principal Runtime Engineer", "Figure", "Sunnyvale, CA", 1, 0.88, 92, "Staff/Principal", "Edge ML & Runtimes", ["ONNX Runtime & Graph Chunking", "MLX Inference Acceleration"], 28, "Automated test fixture"),
                ("t_test_target_1", "Test Target Exec", "VP of Embodied Systems", "Figure", "Sunnyvale, CA", 2, 0.82, 96, "Director/VP/Founder", "Robotics & Embodied AI", ["Humanoid Robotics Telemetry & Data Ops", "Distributed Data Platform Architecture"], 0, "Automated test fixture"),
            ]
            for nid, name, role, co, loc, deg, trust, strat, auth, clus, sk, msgs, ctx in fixture_nodes:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO nodes (
                        id, user_id, full_name, role, company, location, degree,
                        trust_score, strategic_value, authority_level, cluster,
                        skills_json, message_count, connected_on, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-06-15', ?)
                    """,
                    (nid, user_id, name, role, co, loc, deg, trust, strat, auth, clus, json.dumps(sk), msgs, ctx),
                )
            conn.execute("INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context) VALUES (?, ?, ?, ?, 'direct', ?)", (user_id, root_id, "n_test_bridge_1", 0.94, "Teammate"))
            conn.execute("INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context) VALUES (?, ?, ?, ?, 'direct', ?)", (user_id, root_id, "n_test_bridge_2", 0.88, "Direct Connection"))
            conn.execute("INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context) VALUES (?, ?, ?, ?, 'bridge', ?)", (user_id, "n_test_bridge_1", "t_test_target_1", 0.90, "Primary Bridge"))
            conn.execute("INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context) VALUES (?, ?, ?, ?, 'bridge', ?)", (user_id, "n_test_bridge_2", "t_test_target_1", 0.85, "Backup Bridge"))
            conn.commit()
    finally:
        if close_after:
            conn.close()


if __name__ == "__main__":
    seed_database(include_demo_contacts=False)
    print("Database initialized cleanly for Anthony Mikinka (0 placeholder contacts).")
