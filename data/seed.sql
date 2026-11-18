-- Career Network Optimizer — Canonical SQLite WAL Seed Snapshot
-- User: Anthony Mikinka (default_user)
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

INSERT OR REPLACE INTO users (id, full_name, headline, current_company, location, active_goal_mode, active_career_vector, repositories_json, target_roles_json, target_companies_json) VALUES ('default_user', 'Anthony Mikinka', 'Humanoid Robotics Data Operations & Data Platform Architecture (Tesla Optimus / Lingo)', 'Tesla', 'San Jose, CA', 'trajectory', 'Principal Embodied AI & Humanoid Data Architect', '["antmikinka/onnx-model-chunking", "antmikinka/lemon-mlx-engine", "antmikinka/loom", "antmikinka/lemonade"]', '["Principal Embodied AI & Humanoid Data Architect", "Staff Edge ML & Split-Graph Runtime Systems Lead", "Robotics Data & Eval Platform Founder / VP", "Director of Robotics Data Infrastructure"]', '["Tesla", "Apple", "Figure", "OpenAI", "Anthropic", "NVIDIA"]');

INSERT OR REPLACE INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'Automated Test Execution / Loom', 'Core', 86);
INSERT OR REPLACE INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'C++ & Tauri GUI Systems', 'Core', 90);
INSERT OR REPLACE INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'Distributed Data Platform Architecture', 'Leadership', 89);
INSERT OR REPLACE INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'Humanoid Robotics Telemetry & Data Ops', 'Domain', 94);
INSERT OR REPLACE INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'MLX Inference Acceleration', 'Systems', 92);
INSERT OR REPLACE INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'ONNX Runtime & Graph Chunking', 'Systems', 95);

INSERT OR REPLACE INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, authority_level, cluster, skills_json, past_role_3yrs_ago, knn_similarity, vector_cluster, github_overlap, linkedin_url, connected_on, message_count, notes) VALUES ('default_user_root', 'default_user', 'Anthony Mikinka', 'Humanoid Robotics Data Operations & Data Platform Architecture (Tesla Optimus / Lingo)', 'Tesla', 'San Jose, CA', 0, 1.0, 100, 'Staff/Principal', 'Robotics & Embodied AI', '["Automated Test Execution / Loom", "C++ & Tauri GUI Systems", "Distributed Data Platform Architecture", "Humanoid Robotics Telemetry & Data Ops", "MLX Inference Acceleration", "ONNX Runtime & Graph Chunking"]', '', 0, '', '', 'https://linkedin.com/in/antmikinka', '', 0, 'Root User Profile');


COMMIT;