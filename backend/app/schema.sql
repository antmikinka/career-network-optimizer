PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL; -- Enables concurrent reads/writes in SQLite

-- 1. Multi-User / Profile Root (Allows 1 local user or N hosted users)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    headline TEXT,
    current_company TEXT,
    target_roles_json TEXT DEFAULT '[]',     -- e.g., ["Staff ML Engineer", "Robotics Architect"]
    target_companies_json TEXT DEFAULT '[]', -- e.g., ["Figure", "OpenAI", "NVIDIA", "Tesla", "Apple", "Anthropic"]
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Career History & Technical Stack
CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    category TEXT,                           -- 'Core', 'Systems', 'Domain', 'Leadership'
    proficiency INTEGER DEFAULT 80,          -- 1-100 weight for path matching
    UNIQUE(user_id, skill_name)
);

-- 3. Network Nodes (1st, 2nd, and 3rd Degree Contacts)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT,
    company TEXT,
    location TEXT,
    degree INTEGER NOT NULL CHECK (degree IN (0, 1, 2, 3)),
    trust_score REAL DEFAULT 0.5,            -- Auto-computed from message history (0.05 - 1.0)
    strategic_value INTEGER DEFAULT 50,      -- Computed based on target company/role match (0 - 100)
    authority_level TEXT DEFAULT 'Staff/Principal',
    cluster TEXT DEFAULT 'Robotics & Embodied AI',
    skills_json TEXT DEFAULT '[]',           -- Extracted or inferred skills
    past_role_3yrs_ago TEXT DEFAULT '',
    github_overlap TEXT DEFAULT '',
    linkedin_url TEXT,
    connected_on DATE,
    last_interaction_at DATE,
    message_count INTEGER DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Directed/Undirected Graph Edges (Connections Between People)
CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    weight REAL NOT NULL DEFAULT 0.5,        -- Edge strength (0.05 to 1.0)
    relationship_type TEXT DEFAULT 'linkedin_1st', -- 'direct', 'colleague_overlap', 'shared_import', 'bridge'
    context TEXT,                            -- e.g., "24 DMs in LinkedIn Archive", "Ex-Tesla overlap"
    UNIQUE(user_id, source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_user_company ON nodes(user_id, company);
CREATE INDEX IF NOT EXISTS idx_edges_lookup ON edges(user_id, source_id, target_id);
