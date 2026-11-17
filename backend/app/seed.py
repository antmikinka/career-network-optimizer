import json
import sqlite3
import sys
from pathlib import Path
from typing import Optional

# Ensure backend directory is in python search path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import get_db_connection, init_db, DB_PATH

def seed_database(conn: Optional[sqlite3.Connection] = None, user_id: str = "default_user") -> None:
    """Populates SQLite database with high-fidelity network topology and career vector data."""
    close_after = False
    if conn is None:
        init_db()
        conn = get_db_connection()
        close_after = True
        
    try:
        # 1. Seed User Root Profile
        conn.execute("""
            INSERT OR REPLACE INTO users (id, full_name, headline, current_company, target_roles_json, target_companies_json)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            "Alex Mercer",
            "Staff Infrastructure & ML Systems Architect | Humanoid Robotics Data Operations",
            "Ex-Tesla Autonomous Systems",
            json.dumps(["Staff ML Engineer", "Robotics Architect", "Director of Infrastructure", "VP of Engineering"]),
            json.dumps(["Figure", "OpenAI", "NVIDIA", "Tesla", "Apple", "Anthropic"])
        ))
        
        # 2. Seed User Skills
        skills = [
            ("Python", "Core", 95),
            ("C++", "Core", 90),
            ("PyTorch", "Core", 92),
            ("Rust", "Core", 86),
            ("SQL", "Core", 88),
            ("Distributed Systems", "Systems", 96),
            ("ONNX/MLX Split-Graph Execution", "Systems", 94),
            ("Low-Latency Networking", "Systems", 90),
            ("Kafka", "Systems", 88),
            ("GPU Cluster Orchestration", "Systems", 93),
            ("Humanoid Robotics Data Operations", "Domain", 95),
            ("Lingo Data Platform Architecture", "Domain", 92),
            ("Kinematics Teleoperation", "Domain", 89),
            ("Autonomous Fleet Telemetry", "Domain", 87),
            ("Technical Roadmap Strategy", "Leadership", 90),
            ("System Design Reviews", "Leadership", 92),
            ("Cross-Functional Architecture", "Leadership", 89)
        ]
        
        conn.execute("DELETE FROM user_skills WHERE user_id = ?", (user_id,))
        for name, cat, prof in skills:
            conn.execute("""
                INSERT INTO user_skills (user_id, skill_name, category, proficiency)
                VALUES (?, ?, ?, ?)
            """, (user_id, name, cat, prof))
            
        # 3. Clean and Seed Nodes
        conn.execute("DELETE FROM edges WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM nodes WHERE user_id = ?", (user_id,))
        
        root_id = f"{user_id}_root"
        all_skills_list = [s[0] for s in skills]
        
        # Root Node
        conn.execute("""
            INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, linkedin_url, notes)
            VALUES (?, ?, ?, ?, ?, ?, 0, 1.0, 100, ?, ?, ?)
        """, (
            root_id, user_id, "Alex Mercer (You)", "Staff Systems & ML Architect", "Autonomous Systems",
            "San Francisco, CA", json.dumps(all_skills_list), "https://linkedin.com/in/alex-mercer",
            "Root profile node"
        ))
        
        # Node Definitions: (id, name, role, company, location, degree, trust, strategic, skills, dms, context)
        raw_nodes = [
            # 1st Degree Bridge Connectors
            ("n_sarah_chen", "Sarah Chen", "Principal Robotics Engineer", "Figure", "Sunnyvale, CA", 1, 0.92, 95,
             ["ROS2", "Humanoid Robotics Data Operations", "C++", "Kinematics Teleoperation"], 34, "34 DMs in LinkedIn Archive; Ex-Tesla overlap (2021-2023)"),
            ("n_marcus_vance", "Marcus Vance", "Director of Distributed Training", "OpenAI", "San Francisco, CA", 1, 0.94, 98,
             ["Distributed Systems", "GPU Cluster Orchestration", "PyTorch", "Model Architecture"], 42, "42 DMs in LinkedIn Archive; Co-authored low-latency training paper"),
            ("n_elena_rostova", "Elena Rostova", "Senior Staff Systems Architect", "NVIDIA", "Santa Clara, CA", 1, 0.86, 92,
             ["ONNX/MLX Split-Graph Execution", "CUDA", "Low-Latency Networking", "C++"], 22, "22 DMs; GTC speaker panel co-panelist"),
            ("n_david_kim", "David Kim", "Lead Platform Engineer", "Apple", "Cupertino, CA", 1, 0.89, 90,
             ["Distributed Systems", "ONNX/MLX Split-Graph Execution", "Rust", "Lingo Data Platform Architecture"], 28, "28 DMs; Ex-Tesla colleague"),
            ("n_rachel_patel", "Rachel Patel", "Head of AI Data Infrastructure", "Anthropic", "San Francisco, CA", 1, 0.83, 94,
             ["Lingo Data Platform Architecture", "Kafka", "Distributed Systems", "Python"], 19, "19 DMs; Frequent technical collaborator"),
            ("n_jason_brody", "Jason Brody", "Staff Integration Architect", "Tesla", "Palo Alto, CA", 1, 0.96, 88,
             ["Autonomous Fleet Telemetry", "C++", "Humanoid Robotics Data Operations", "Distributed Systems"], 52, "52 DMs; 3 years direct teammate on Autopilot/Optimus"),
            ("n_priya_sharma", "Priya Sharma", "Senior ML Infrastructure Engineer", "Figure", "Sunnyvale, CA", 1, 0.78, 89,
             ["PyTorch", "Humanoid Robotics Data Operations", "Kafka"], 14, "14 DMs; Connected via Sarah Chen"),
            ("n_kevin_zhang", "Kevin Zhang", "Principal Research Scientist", "OpenAI", "San Francisco, CA", 1, 0.75, 91,
             ["PyTorch", "Model Architecture", "GPU Cluster Orchestration"], 11, "11 DMs; Former Berkeley lab peer"),
            ("n_maya_lin", "Maya Lin", "Senior ML Systems Engineer", "NVIDIA", "Santa Clara, CA", 1, 0.70, 86,
             ["CUDA", "ONNX/MLX Split-Graph Execution", "C++"], 8, "8 DMs; Colleague of Elena Rostova"),
            ("n_carlos_mendez", "Carlos Mendez", "Staff Robotics Controls Engineer", "Figure", "Sunnyvale, CA", 1, 0.72, 88,
             ["Kinematics Teleoperation", "ROS2", "C++"], 9, "9 DMs; Robotics conference connection"),
            ("n_chloe_bennett", "Chloe Bennett", "Engineering Manager, Foundation Models", "Anthropic", "San Francisco, CA", 1, 0.81, 93,
             ["Distributed Systems", "Technical Roadmap Strategy", "PyTorch"], 16, "16 DMs; Collaborated on alignment benchmarks"),
            ("n_derek_wu", "Derek Wu", "Staff Systems Performance Lead", "Apple", "Cupertino, CA", 1, 0.65, 84,
             ["Low-Latency Networking", "C++", "Rust"], 6, "6 DMs; Recruited into Apple Core OS"),

            # 2nd Degree Target Decision Makers
            ("t_figure_vp", "Dr. Jonathan Ross", "VP of Software & AI Systems", "Figure", "Sunnyvale, CA", 2, 0.45, 99,
             ["Humanoid Robotics Data Operations", "Distributed Systems", "Kinematics Teleoperation", "Technical Roadmap Strategy"], 0, "Hiring executive for Figure 02 Fleet Ops & ML Architecture"),
            ("t_openai_infra_vp", "Dr. Mira Sterling", "VP of Supercomputing & Systems", "OpenAI", "San Francisco, CA", 2, 0.48, 100,
             ["GPU Cluster Orchestration", "Distributed Systems", "Low-Latency Networking"], 0, "Overseeing trillion-parameter distributed training infra"),
            ("t_nvidia_director", "Vikram Malhotra", "Director of Robotics AI & Simulation", "NVIDIA", "Santa Clara, CA", 2, 0.42, 97,
             ["ONNX/MLX Split-Graph Execution", "CUDA", "Kinematics Teleoperation"], 0, "Leading Project GR00T & Omniverse physical AI stack"),
            ("t_apple_exec", "Julian Thorne", "Senior Director of Apple Silicon ML Runtime", "Apple", "Cupertino, CA", 2, 0.40, 95,
             ["ONNX/MLX Split-Graph Execution", "Low-Latency Networking", "Rust"], 0, "Leading unified on-device and private cloud ML compute"),
            ("t_anthropic_vp", "Dr. Nathan Vance", "VP of Frontier Infrastructure", "Anthropic", "San Francisco, CA", 2, 0.44, 98,
             ["Lingo Data Platform Architecture", "Distributed Systems", "GPU Cluster Orchestration"], 0, "Scaling next-generation Claude compute clusters"),
            ("t_tesla_optimus_dir", "Gavin Vance", "Director of Optimus Software Architecture", "Tesla", "Palo Alto, CA", 2, 0.50, 96,
             ["Humanoid Robotics Data Operations", "Autonomous Fleet Telemetry", "C++"], 0, "Leading full autonomy software stack for Optimus humanoid robot"),

            # 3rd Degree High-Impact Nodes (Venture Partners & Ecosystem Champions)
            ("t_lux_partner", "Devon King", "Founding Partner (DeepTech & Robotics)", "Lux Capital", "San Francisco, CA", 3, 0.25, 93,
             ["Technical Roadmap Strategy", "Humanoid Robotics Data Operations"], 0, "Board member across premier humanoid robotics startups"),
            ("t_founders_fund", "Leah Sterling", "Partner (Frontier AI & Physical Systems)", "Founders Fund", "San Francisco, CA", 3, 0.25, 92,
             ["Distributed Systems", "Technical Roadmap Strategy"], 0, "Key investor in autonomous hardware and frontier computing platforms")
        ]
        
        for nid, name, role, comp, loc, deg, trust, strat, sk, dms, notes in raw_nodes:
            conn.execute("""
                INSERT OR REPLACE INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, linkedin_url, message_count, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                nid, user_id, name, role, comp, loc, deg, trust, strat, json.dumps(sk),
                f"https://linkedin.com/in/{nid.replace('_', '-')}", dms, notes
            ))
            
        # 4. Seed Edges
        # Edges from root to 1st degree
        for nid, _, _, _, _, deg, trust, _, _, _, notes in raw_nodes:
            if deg == 1:
                conn.execute("""
                    INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
                    VALUES (?, ?, ?, ?, 'linkedin_1st', ?)
                """, (user_id, root_id, nid, trust, notes))
                
        # Bridge Edges from 1st degree to 2nd degree
        bridge_edges = [
            # Figure bridges
            ("n_sarah_chen", "t_figure_vp", 0.88, "bridge", "Sarah Chen directly reports to / collaborates with Dr. Jonathan Ross on Figure 02 telemetry"),
            ("n_carlos_mendez", "t_figure_vp", 0.72, "bridge", "Controls team synchronization with VP office"),
            ("n_priya_sharma", "t_figure_vp", 0.70, "bridge", "ML infra updates to VP office"),
            # OpenAI bridges
            ("n_marcus_vance", "t_openai_infra_vp", 0.90, "bridge", "Marcus Vance co-leads supercomputing infrastructure with Dr. Mira Sterling"),
            ("n_kevin_zhang", "t_openai_infra_vp", 0.74, "bridge", "Research-infrastructure alignment"),
            # NVIDIA bridges
            ("n_elena_rostova", "t_nvidia_director", 0.86, "bridge", "Elena designs core architecture for Vikram's robotics simulation clusters"),
            ("n_maya_lin", "t_nvidia_director", 0.72, "bridge", "Internal team contributor"),
            # Apple bridges
            ("n_david_kim", "t_apple_exec", 0.85, "bridge", "David Kim collaborates directly with Julian Thorne on ML runtime architecture"),
            ("n_derek_wu", "t_apple_exec", 0.68, "bridge", "Systems performance review board"),
            # Anthropic bridges
            ("n_rachel_patel", "t_anthropic_vp", 0.87, "bridge", "Rachel Patel coordinates data pipeline scaling directly with Dr. Nathan Vance"),
            ("n_chloe_bennett", "t_anthropic_vp", 0.78, "bridge", "Foundation model deployment meetings"),
            # Tesla Optimus bridges
            ("n_jason_brody", "t_tesla_optimus_dir", 0.92, "bridge", "Jason is tech lead under Gavin Vance in Optimus architecture group"),
            # 2nd to 3rd degree links
            ("t_figure_vp", "t_lux_partner", 0.75, "bridge", "Board relationship: Lux Capital Series B investment"),
            ("t_openai_infra_vp", "t_founders_fund", 0.72, "bridge", "Frontier AI advisory relationship"),
            # Peer-to-peer internal edges (makes graph realistic)
            ("n_sarah_chen", "n_priya_sharma", 0.82, "colleague_overlap", "Figure robotics team internal sync"),
            ("n_sarah_chen", "n_carlos_mendez", 0.80, "colleague_overlap", "Figure hardware/software co-design"),
            ("n_marcus_vance", "n_kevin_zhang", 0.84, "colleague_overlap", "OpenAI training cluster peers"),
            ("n_elena_rostova", "n_maya_lin", 0.81, "colleague_overlap", "NVIDIA architecture team peers"),
            ("n_david_kim", "n_derek_wu", 0.78, "colleague_overlap", "Apple platform team peers"),
            ("n_rachel_patel", "n_chloe_bennett", 0.80, "colleague_overlap", "Anthropic infrastructure and model leads")
        ]
        
        for src, tgt, w, rel, ctx in bridge_edges:
            conn.execute("""
                INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, src, tgt, w, rel, ctx))
            
        conn.commit()
    finally:
        if close_after:
            conn.close()

if __name__ == "__main__":
    seed_database()
    print("Database successfully seeded with realistic network topology!")
