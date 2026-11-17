-- ==================================================================
-- Nexus Career & Network Optimizer: Production SQLite seed.sql
-- Zero Mock Placeholders — Clean State Ready for LinkedIn Ingestion
-- Usage: sqlite3 data/optimizer.db < data/seed.sql
-- ==================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

BEGIN TRANSACTION;

-- Clean existing placeholder data
DELETE FROM edges;
DELETE FROM nodes;
DELETE FROM user_skills;
DELETE FROM users;

-- 1. Real User Root Profile
INSERT OR REPLACE INTO users (id, full_name, headline, current_company, target_roles_json, target_companies_json)
VALUES (
    'default_user',
    'Anthony Mikinka',
    'Humanoid Robotics Data Operations & Data Platform Architecture (Tesla Optimus / Lingo)',
    'Tesla',
    '["Principal Embodied AI & Humanoid Data Architect", "Staff Edge ML & Split-Graph Runtime Systems Lead", "Robotics Data & Eval Platform Founder / VP", "Director of Robotics Data Infrastructure"]',
    '["Tesla", "Apple", "Figure", "OpenAI", "Anthropic", "NVIDIA"]'
);

-- 2. Real Technical Stack & Competencies
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'ONNX Runtime & Graph Chunking', 'Systems', 95);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'MLX Inference Acceleration', 'Systems', 92);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'C++ & Tauri GUI Systems', 'Core', 90);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'Humanoid Robotics Telemetry & Data Ops', 'Domain', 94);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'Distributed Data Platform Architecture', 'Leadership', 89);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('default_user', 'Automated Test Execution / Loom', 'Core', 86);

-- 3. Real Root Node (0° Degree — You)
INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, authority_level, cluster, skills_json, linkedin_url, notes)
VALUES (
    'default_user_root',
    'default_user',
    'Anthony Mikinka (You)',
    'Humanoid Robotics Data Operations & Data Platform Architecture',
    'Tesla',
    'San Jose, CA',
    0,
    1.0,
    100,
    'Staff/Principal',
    'Robotics & Embodied AI',
    '["ONNX Runtime & Graph Chunking", "MLX Inference Acceleration", "C++ & Tauri GUI Systems", "Humanoid Robotics Telemetry & Data Ops", "Distributed Data Platform Architecture", "Automated Test Execution / Loom"]',
    'https://linkedin.com/in/antmikinka',
    'Root User Profile'
);

COMMIT;
