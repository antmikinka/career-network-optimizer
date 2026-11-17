-- ==================================================================
-- Career Network Optimizer: SQLite seed.sql Snapshot
-- Usage: sqlite3 data/optimizer.db < data/seed.sql
-- ==================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

BEGIN TRANSACTION;

-- Clean existing data
DELETE FROM edges;
DELETE FROM nodes;
DELETE FROM user_skills;
DELETE FROM users;

-- 1. Root Profile
INSERT OR REPLACE INTO users (id, full_name, headline, current_company, target_roles_json, target_companies_json)
VALUES (
    'alex_mercer',
    'Alex Mercer',
    'Staff Infrastructure & ML Systems Architect | Humanoid Robotics Data Operations',
    'Autonomous Systems (Ex-Tesla)',
    '["Staff ML Engineer", "Robotics Architect", "Director of Infrastructure", "VP of Engineering"]',
    '["Figure", "OpenAI", "NVIDIA", "Tesla", "Apple", "Anthropic", "LinkedIn"]'
);

-- 2. Technical Stack
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Python', 'Core', 95);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'C++', 'Core', 92);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'PyTorch', 'Core', 94);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Rust', 'Core', 88);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'SQL', 'Core', 90);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Distributed Systems', 'Systems', 96);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'ONNX/MLX Split-Graph Execution', 'Systems', 94);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Low-Latency Networking', 'Systems', 90);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Kafka', 'Systems', 88);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'GPU Cluster Orchestration', 'Systems', 93);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Humanoid Robotics Data Operations', 'Domain', 95);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Lingo Data Platform Architecture', 'Domain', 92);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Kinematics Teleoperation', 'Domain', 89);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Autonomous Fleet Telemetry', 'Domain', 87);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Technical Roadmap Strategy', 'Leadership', 90);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'System Design Reviews', 'Leadership', 92);
INSERT INTO user_skills (user_id, skill_name, category, proficiency) VALUES ('alex_mercer', 'Cross-Functional Architecture', 'Leadership', 89);

-- 3. Network Nodes (Founder 15-Node Multi-Degree Topology)
INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('root_alex', 'alex_mercer', 'Alex Mercer (You)', 'Staff Systems & ML Architect', 'Autonomous Systems', 'San Francisco, CA', 0, 1.0, 100, '["Distributed Systems", "PyTorch", "Humanoid Robotics Data Operations", "ONNX/MLX Split-Graph Execution", "C++"]', 'Root founder node');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('n_sarah_chen', 'alex_mercer', 'Sarah Chen', 'Principal Robotics Engineer', 'Figure', 'Sunnyvale, CA', 1, 0.92, 95, '["ROS2", "Humanoid Robotics Data Operations", "C++", "Kinematics Teleoperation"]', '34 DMs; Ex-Tesla overlap (2021-2023)');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('n_marcus_vance', 'alex_mercer', 'Marcus Vance', 'Director of Distributed Training', 'OpenAI', 'San Francisco, CA', 1, 0.94, 98, '["Distributed Systems", "GPU Cluster Orchestration", "PyTorch", "Model Architecture"]', '42 DMs; Co-authored low-latency training paper');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('n_jason_brody', 'alex_mercer', 'Jason Brody', 'Staff Integration Architect', 'Tesla', 'Palo Alto, CA', 1, 0.96, 88, '["Autonomous Fleet Telemetry", "C++", "Humanoid Robotics Data Operations", "Distributed Systems"]', '52 DMs; 3 years direct teammate on Optimus');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('n_elena_rostova', 'alex_mercer', 'Elena Rostova', 'Senior Staff Systems Architect', 'NVIDIA', 'Santa Clara, CA', 1, 0.86, 92, '["ONNX/MLX Split-Graph Execution", "CUDA", "Low-Latency Networking", "C++"]', '22 DMs; GTC speaker panel');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('n_david_kim', 'alex_mercer', 'David Kim', 'Lead Platform Engineer', 'Apple', 'Cupertino, CA', 1, 0.89, 90, '["Distributed Systems", "ONNX/MLX Split-Graph Execution", "Rust", "Lingo Data Platform Architecture"]', '28 DMs; Ex-Tesla colleague');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('n_rachel_patel', 'alex_mercer', 'Rachel Patel', 'Head of AI Data Infrastructure', 'Anthropic', 'San Francisco, CA', 1, 0.83, 94, '["Lingo Data Platform Architecture", "Kafka", "Distributed Systems", "Python"]', '19 DMs; Frequent collaborator');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('n_anita_desai', 'alex_mercer', 'Anita Desai', 'Director of Graph Platform Architecture', 'LinkedIn', 'Sunnyvale, CA', 1, 0.88, 91, '["Distributed Systems", "Kafka", "SQL", "Lingo Data Platform Architecture"]', '24 DMs; Economic graph data pipelines');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('n_carlos_mendez', 'alex_mercer', 'Carlos Mendez', 'Staff Robotics Controls Engineer', 'Figure', 'Sunnyvale, CA', 1, 0.76, 88, '["Kinematics Teleoperation", "ROS2", "C++"]', '12 DMs; Robotics conference co-speaker');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('n_kevin_zhang', 'alex_mercer', 'Kevin Zhang', 'Principal Research Scientist', 'OpenAI', 'San Francisco, CA', 1, 0.75, 91, '["PyTorch", "Model Architecture", "GPU Cluster Orchestration"]', '11 DMs; Former Berkeley lab peer');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('t_figure_vp', 'alex_mercer', 'Dr. Jonathan Ross', 'VP of Software & AI Systems', 'Figure', 'Sunnyvale, CA', 2, 0.45, 99, '["Humanoid Robotics Data Operations", "Distributed Systems", "Kinematics Teleoperation", "Technical Roadmap Strategy"]', 'Key hiring executive for Figure 02 Fleet Ops & ML Architecture');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('t_openai_infra_vp', 'alex_mercer', 'Dr. Mira Sterling', 'VP of Supercomputing & Systems', 'OpenAI', 'San Francisco, CA', 2, 0.48, 100, '["GPU Cluster Orchestration", "Distributed Systems", "Low-Latency Networking", "PyTorch"]', 'Overseeing trillion-parameter distributed training clusters');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('t_nvidia_director', 'alex_mercer', 'Vikram Malhotra', 'Director of Robotics AI & Simulation', 'NVIDIA', 'Santa Clara, CA', 2, 0.42, 97, '["ONNX/MLX Split-Graph Execution", "CUDA", "Kinematics Teleoperation"]', 'Leading Project GR00T & Omniverse physical AI');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('t_apple_exec', 'alex_mercer', 'Julian Thorne', 'Senior Director of Apple Silicon ML Runtime', 'Apple', 'Cupertino, CA', 2, 0.40, 95, '["ONNX/MLX Split-Graph Execution", "Low-Latency Networking", "Rust"]', 'Leading unified on-device and private cloud ML runtime');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('t_anthropic_vp', 'alex_mercer', 'Dr. Nathan Vance', 'VP of Frontier Infrastructure', 'Anthropic', 'San Francisco, CA', 2, 0.44, 98, '["Lingo Data Platform Architecture", "Distributed Systems", "GPU Cluster Orchestration"]', 'Scaling next-generation Claude compute clusters');

INSERT INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json, notes)
VALUES ('t_tesla_optimus_dir', 'alex_mercer', 'Gavin Vance', 'Director of Optimus Software Architecture', 'Tesla', 'Palo Alto, CA', 2, 0.50, 96, '["Humanoid Robotics Data Operations", "Autonomous Fleet Telemetry", "C++"]', 'Leading full autonomy software stack for Optimus humanoid robot');

-- 4. Adjacency Edges
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'root_alex', 'n_sarah_chen', 0.92, 'linkedin_1st', '34 DMs; Ex-Tesla overlap (2021-2023)');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'root_alex', 'n_marcus_vance', 0.94, 'linkedin_1st', '42 DMs; Co-authored low-latency training paper');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'root_alex', 'n_jason_brody', 0.96, 'linkedin_1st', '52 DMs; 3 years direct teammate on Optimus');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'root_alex', 'n_elena_rostova', 0.86, 'linkedin_1st', '22 DMs; GTC speaker panel');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'root_alex', 'n_david_kim', 0.89, 'linkedin_1st', '28 DMs; Ex-Tesla colleague');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'root_alex', 'n_rachel_patel', 0.83, 'linkedin_1st', '19 DMs; Frequent technical collaborator');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'root_alex', 'n_anita_desai', 0.88, 'linkedin_1st', '24 DMs; Economic graph data pipelines');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'root_alex', 'n_carlos_mendez', 0.76, 'linkedin_1st', '12 DMs; Robotics conference co-speaker');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'root_alex', 'n_kevin_zhang', 0.75, 'linkedin_1st', '11 DMs; Former Berkeley lab peer');

-- Bridges to Targets
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_sarah_chen', 't_figure_vp', 0.88, 'bridge', 'Primary: Direct reports & fleet architecture reviews');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_carlos_mendez', 't_figure_vp', 0.74, 'bridge', 'Backup: Controls team sync with VP office');

INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_marcus_vance', 't_openai_infra_vp', 0.90, 'bridge', 'Primary: Supercomputing leadership team sync');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_kevin_zhang', 't_openai_infra_vp', 0.76, 'bridge', 'Backup: Foundation model training alignment');

INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_jason_brody', 't_tesla_optimus_dir', 0.92, 'bridge', 'Primary: Lead architect on Gavin Vance team');

INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_elena_rostova', 't_nvidia_director', 0.86, 'bridge', 'Primary: Core architecture for Vikram simulation clusters');

INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_david_kim', 't_apple_exec', 0.85, 'bridge', 'Primary: ML runtime runtime collaboration');

INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_rachel_patel', 't_anthropic_vp', 0.87, 'bridge', 'Primary: Data pipeline scaling coordination');

-- Colleague Overlaps
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_sarah_chen', 'n_carlos_mendez', 0.80, 'colleague_overlap', 'Figure hardware/software co-design');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_marcus_vance', 'n_kevin_zhang', 0.82, 'colleague_overlap', 'OpenAI training cluster peers');
INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
VALUES ('alex_mercer', 'n_david_kim', 'n_elena_rostova', 0.75, 'colleague_overlap', 'Compiler runtime working group');

COMMIT;
