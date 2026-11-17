import json
import sqlite3
import sys
from pathlib import Path
from typing import Optional

# Ensure backend directory is in python search path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import get_db_connection, init_db, DB_PATH

def seed_database(conn: Optional[sqlite3.Connection] = None, user_id: str = "default_user", include_demo_contacts: bool = False) -> None:
    """
    Seeds database with Anthony Mikinka's real profile, technical competencies,
    and target companies. By default (include_demo_contacts=False), NO fake placeholder
    contacts or edges are populated.
    """
    close_after = False
    if conn is None:
        init_db()
        conn = get_db_connection()
        close_after = True
        
    try:
        # 1. Real User Root Profile
        conn.execute("""
            INSERT OR REPLACE INTO users (id, full_name, headline, current_company, target_roles_json, target_companies_json)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            "Anthony Mikinka",
            "Humanoid Robotics Data Operations & Data Platform Architecture (Tesla Optimus / Lingo)",
            "Tesla",
            json.dumps([
                "Principal Embodied AI & Humanoid Data Architect",
                "Staff Edge ML & Split-Graph Runtime Systems Lead",
                "Robotics Data & Eval Platform Founder / VP",
                "Director of Robotics Data Infrastructure"
            ]),
            json.dumps(["Tesla", "Apple", "Figure", "OpenAI", "Anthropic", "NVIDIA"])
        ))
        
        # 2. Real Technical Stack & Competencies
        skills = [
            ("ONNX Runtime & Graph Chunking", "Systems", 95),
            ("MLX Inference Acceleration", "Systems", 92),
            ("C++ & Tauri GUI Systems", "Core", 90),
            ("Humanoid Robotics Telemetry & Data Ops", "Domain", 94),
            ("Distributed Data Platform Architecture", "Leadership", 89),
            ("Automated Test Execution / Loom", "Core", 86)
        ]
        
        conn.execute("DELETE FROM user_skills WHERE user_id = ?", (user_id,))
        for name, cat, prof in skills:
            conn.execute("""
                INSERT INTO user_skills (user_id, skill_name, category, proficiency)
                VALUES (?, ?, ?, ?)
            """, (user_id, name, cat, prof))
            
        # 3. Clean Nodes & Edges (Remove all placeholders)
        conn.execute("DELETE FROM edges WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM nodes WHERE user_id = ?", (user_id,))
        
        root_id = f"{user_id}_root"
        all_skills_list = [s[0] for s in skills]
        
        # Insert Root Profile Node (Anthony Mikinka)
        conn.execute("""
            INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, authority_level, cluster, skills_json, linkedin_url, notes)
            VALUES (?, ?, ?, ?, ?, ?, 0, 1.0, 100, 'Staff/Principal', 'Robotics & Embodied AI', ?, ?, ?)
        """, (
            root_id, user_id, "Anthony Mikinka (You)",
            "Humanoid Robotics Data Operations & Data Platform Architecture", "Tesla",
            "San Jose, CA", json.dumps(all_skills_list), "https://linkedin.com/in/antmikinka",
            "Real User Profile"
        ))

        # Only inject demo contacts if explicitly requested (e.g., in integration test harnesses)
        if include_demo_contacts:
            raw_nodes = [
                ("n_sarah_chen", "Sarah Chen", "Principal Robotics Engineer", "Figure", "Sunnyvale, CA", 1, 0.92, 95, "Director/VP/Founder", "Robotics & Embodied AI", ["Humanoid Robotics Telemetry & Data Ops", "C++ & Tauri GUI Systems"], 34, "Ex-colleague"),
                ("n_marcus_vance", "Marcus Vance", "Director of Distributed Training", "OpenAI", "San Francisco, CA", 1, 0.94, 98, "Director/VP/Founder", "Edge ML & Runtimes", ["Distributed Data Platform Architecture"], 42, "Collaborator"),
                ("n_jason_brody", "Jason Brody", "Staff Integration Architect", "Tesla", "Palo Alto, CA", 1, 0.96, 88, "Staff/Principal", "Robotics & Embodied AI", ["Humanoid Robotics Telemetry & Data Ops"], 52, "Direct teammate"),
                ("t_figure_vp", "Gavin Vance", "VP of Embodied Systems", "Figure", "Sunnyvale, CA", 2, 0.85, 96, "Director/VP/Founder", "Robotics & Embodied AI", ["Humanoid Robotics Telemetry & Data Ops"], 0, "Target decision maker")
            ]
            for nid, name, role, co, loc, deg, trust, strat, auth, clus, sk, msgs, ctx in raw_nodes:
                conn.execute("""
                    INSERT OR REPLACE INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, authority_level, cluster, skills_json, message_count, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (nid, user_id, name, role, co, loc, deg, trust, strat, auth, clus, json.dumps(sk), msgs, ctx))

            # Bridge edges
            conn.execute("INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, context) VALUES (?, ?, ?, ?, ?)", (user_id, root_id, "n_jason_brody", 0.96, "Tesla Teammate"))
            conn.execute("INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, context) VALUES (?, ?, ?, ?, ?)", (user_id, root_id, "n_sarah_chen", 0.92, "Direct Bridge"))
            conn.execute("INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, context) VALUES (?, ?, ?, ?, ?)", (user_id, "n_jason_brody", "t_figure_vp", 0.92, "Figure Bridge"))
            conn.execute("INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, context) VALUES (?, ?, ?, ?, ?)", (user_id, "n_sarah_chen", "t_figure_vp", 0.88, "Secondary Bridge"))

        conn.commit()
    finally:
        if close_after:
            conn.close()

if __name__ == "__main__":
    seed_database()
    print("Database re-seeded cleanly for Anthony Mikinka with 0 placeholder contacts.")
