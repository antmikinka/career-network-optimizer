PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Multi-User / Profile Root (Supports single local user or multi-user deployments)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    headline TEXT,
    current_company TEXT,
    location TEXT DEFAULT 'San Jose, CA',
    active_goal_mode TEXT DEFAULT 'trajectory',
    active_career_vector TEXT DEFAULT 'Principal Embodied AI & Humanoid Data Architect',
    repositories_json TEXT DEFAULT '[]',
    target_roles_json TEXT DEFAULT '[]',
    target_companies_json TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Career History & Weighted Technical Stack
CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    category TEXT DEFAULT 'Systems',
    proficiency INTEGER DEFAULT 85,
    UNIQUE(user_id, skill_name)
);

-- 3. Network Nodes (0 = Root User, 1 = 1st-Degree, 2 = 2nd-Degree, 3 = 3rd-Degree)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT '',
    company TEXT DEFAULT '',
    location TEXT DEFAULT '',
    degree INTEGER NOT NULL CHECK (degree IN (0, 1, 2, 3)),
    trust_score REAL DEFAULT 0.5,
    strategic_value INTEGER DEFAULT 50,
    authority_level TEXT DEFAULT 'Staff/Principal',
    cluster TEXT DEFAULT 'Robotics & Embodied AI',
    skills_json TEXT DEFAULT '[]',
    past_role_3yrs_ago TEXT DEFAULT '',
    knn_similarity INTEGER DEFAULT 0,
    vector_cluster TEXT DEFAULT '',
    github_overlap TEXT DEFAULT '',
    linkedin_url TEXT DEFAULT '',
    connected_on TEXT DEFAULT '',
    last_interaction_at TEXT DEFAULT '',
    message_count INTEGER DEFAULT 0,
    betweenness_centrality REAL DEFAULT 0.0,
    pagerank REAL DEFAULT 0.0,
    ev_score INTEGER DEFAULT 0,
    conversion_prob REAL DEFAULT 0.0,
    notes TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Graph Adjacency Edges (Weighted Undirected/Directed Relationships)
CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    weight REAL NOT NULL DEFAULT 0.5,
    relationship_type TEXT DEFAULT 'direct',
    context TEXT DEFAULT '',
    UNIQUE(user_id, source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_user_degree ON nodes(user_id, degree);
CREATE INDEX IF NOT EXISTS idx_nodes_user_company ON nodes(user_id, company);
CREATE INDEX IF NOT EXISTS idx_edges_lookup ON edges(user_id, source_id, target_id);
