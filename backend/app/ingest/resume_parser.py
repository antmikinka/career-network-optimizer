import re
import json
import sqlite3
from typing import Dict, List, Any, Optional

SKILL_CATALOG = {
    "Core": [
        "Python", "C++", "Rust", "Go", "PyTorch", "TypeScript", "SQL", "CUDA", "TensorFlow", "React"
    ],
    "Systems": [
        "Distributed Systems", "ONNX/MLX Split-Graph Execution", "Kafka", "Kubernetes",
        "Low-Latency Networking", "GPU Cluster Orchestration", "Ray", "Triton", "eBPF", "Docker"
    ],
    "Domain": [
        "Humanoid Robotics Data Operations", "Lingo Data Platform Architecture",
        "Kinematics Teleoperation", "Autonomous Fleet Telemetry", "Synthetic Data Generation",
        "Foundation Model Pre-Training", "Vision-Language-Action (VLA)"
    ],
    "Leadership": [
        "Technical Roadmap Strategy", "Cross-Functional Architecture", "System Design Reviews",
        "Engineering Mentorship", "Talent Acquisition & Hiring"
    ]
}

def parse_resume_text(text: str) -> Dict[str, Any]:
    """
    Heuristically extracts profile metadata and categorized skills from resume text.
    """
    text_lower = text.lower()
    
    # 1. Extract detected skills
    detected_skills: List[Dict[str, Any]] = []
    seen = set()
    
    for category, skills in SKILL_CATALOG.items():
        for skill in skills:
            # Check for exact or token match
            pattern = r'\b' + re.escape(skill.lower()) + r'\b'
            if re.search(pattern, text_lower) or skill.lower() in text_lower:
                if skill.lower() not in seen:
                    seen.add(skill.lower())
                    # Default proficiency 85, higher for core matches
                    proficiency = 90 if category in ("Core", "Domain") else 85
                    detected_skills.append({
                        "skill_name": skill,
                        "category": category,
                        "proficiency": proficiency
                    })
                    
    # If text is short or custom, add defaults if nothing found
    if not detected_skills:
        detected_skills = [
            {"skill_name": "Distributed Systems", "category": "Systems", "proficiency": 92},
            {"skill_name": "PyTorch", "category": "Core", "proficiency": 95},
            {"skill_name": "Humanoid Robotics Data Operations", "category": "Domain", "proficiency": 90},
            {"skill_name": "ONNX/MLX Split-Graph Execution", "category": "Systems", "proficiency": 88},
            {"skill_name": "Lingo Data Platform Architecture", "category": "Domain", "proficiency": 86},
            {"skill_name": "Technical Roadmap Strategy", "category": "Leadership", "proficiency": 84},
        ]
        
    # 2. Extract potential companies
    known_companies = ["Tesla", "Apple", "Figure", "OpenAI", "NVIDIA", "Google", "Meta", "Amazon", "Anthropic", "Microsoft"]
    matched_companies = [c for c in known_companies if c.lower() in text_lower]
    
    return {
        "skills": detected_skills,
        "matched_companies": matched_companies,
        "raw_length": len(text)
    }

def ingest_resume_into_db(
    conn: sqlite3.Connection,
    user_id: str,
    resume_text: str,
    full_name: Optional[str] = None,
    headline: Optional[str] = None,
    target_roles: Optional[List[str]] = None,
    target_companies: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Updates user profile and inserts categorized skills into the database."""
    parsed = parse_resume_text(resume_text)
    
    # Update or insert user
    user_row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    current_companies = json.loads(user_row["target_companies_json"]) if user_row and user_row["target_companies_json"] else ["Figure", "OpenAI", "NVIDIA", "Tesla", "Apple", "Anthropic"]
    current_roles = json.loads(user_row["target_roles_json"]) if user_row and user_row["target_roles_json"] else ["Staff ML Engineer", "Robotics Architect", "Director of Infrastructure"]
    
    final_companies = target_companies if target_companies is not None else current_companies
    final_roles = target_roles if target_roles is not None else current_roles
    
    final_name = full_name or (user_row["full_name"] if user_row else "Alex Mercer")
    final_headline = headline or (user_row["headline"] if user_row else "Lead ML Systems & Robotics Architect")
    
    conn.execute("""
        INSERT INTO users (id, full_name, headline, current_company, target_roles_json, target_companies_json)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            full_name = excluded.full_name,
            headline = excluded.headline,
            target_roles_json = excluded.target_roles_json,
            target_companies_json = excluded.target_companies_json
    """, (
        user_id,
        final_name,
        final_headline,
        parsed["matched_companies"][0] if parsed["matched_companies"] else "Staff Architect",
        json.dumps(final_roles),
        json.dumps(final_companies)
    ))
    
    # Insert or update skills
    for s in parsed["skills"]:
        conn.execute("""
            INSERT INTO user_skills (user_id, skill_name, category, proficiency)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, skill_name) DO UPDATE SET
                category = excluded.category,
                proficiency = excluded.proficiency
        """, (user_id, s["skill_name"], s["category"], s["proficiency"]))
        
    conn.commit()
    return {
        "user_id": user_id,
        "skills_saved": len(parsed["skills"]),
        "skills": parsed["skills"]
    }
