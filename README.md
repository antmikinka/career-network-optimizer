# 🌐 Nexus Career & Network Optimizer (v3)

> **A zero-friction, local-first career graph intelligence engine, Expected Value ($EV$) pathfinder, and automated outreach synthesizer.**  
> Built with an embedded **SQLite relational-graph hybrid**, in-memory **NetworkX Dijkstra pathfinding**, automated **LinkedIn CSV archive ingestion**, and an interactive **Vite + React + Tailwind** concentric orbital visualizer.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.163.1-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=flat&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.4.21-646CFF?style=flat&logo=vite)](https://vitejs.dev)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=flat&logo=sqlite)](https://sqlite.org)
[![NetworkX](https://img.shields.io/badge/NetworkX-Graph_Engine-blue?style=flat)](https://networkx.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.14-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com)

---

## ⚡ Quick Start (Under 60 Seconds)

### Prerequisites
- **Python 3.10+** (with `pip` and virtual environment support)
- **Node.js 18+** & **npm**

---

### One-Command Setup & Run

#### Option 1: Windows (PowerShell)

```powershell
# 1. Setup virtual environment & dependencies
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt
npm --prefix frontend install

# 2. Start FastAPI Backend (Terminal 1)
.\.venv\Scripts\uvicorn --app-dir backend app.main:app --host 127.0.0.1 --port 8000

# 3. Start Vite Frontend Dev Server (Terminal 2)
npm --prefix frontend run dev
```

#### Option 2: macOS / Linux / WSL

```bash
# 1. Install & configure
make setup

# 2. Launch both backend & frontend concurrently
make dev
```

#### Option 3: Docker Compose

```bash
docker-compose up --build
```

---

### Access Endpoints

| Service | URL | Purpose |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:5173/](http://localhost:5173/) | Interactive Graph, EV Engine & Outreach Synthesizer |
| **Backend REST API** | [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) | Health status & live SQLite graph stats |
| **Interactive API Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Interactive Swagger UI for all REST endpoints |

---

## 🧠 Core Architecture & Mathematical Foundation

Most personal graph tools fail because they demand heavy graph database servers (Neo4j, Memgraph) and complex Docker infrastructure just to visualize 1,000 nodes. **Nexus Career & Network Optimizer** uses **SQLite as an embedded relational-graph hybrid** paired with an in-memory **NetworkX Dijkstra pathfinder** and **client-side reactive persistence (`cno_db_v3`)**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Vite + React Frontend (Port 5173)               │
│   • Concentric Orbital SVG Visualizer (<150 nodes)                     │
│   • 4-Mode Expected Value (EV) Optimizer & Goal Selector               │
│   • Highest-Leverage ΔEV Bridge Conditioning Simulator (+0.25 Trust)   │
│   • k-NN Trajectory Lookahead & GitHub Outbound Target Synthesizer     │
│   • Dual Route Redundancy (Primary Route #1 vs. Backup Route #2)       │
│   • Live localStorage Persistence (cno_db_v3) + SQLite seed.sql Export │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Reverse Proxy (/api, /ws)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend (Port 8000)                     │
│   • Weighted Dijkstra Pathfinding: c(e) = -ln(w)                       │
│   • Super-Connector Betweenness Centrality Ranking (C_B)               │
│   • Multiplicative Route Reachability: P = exp(-Σ c_i) × 100%          │
│   • Automated 3-Stage LinkedIn Archive Parser & Coworker Overlap       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Embedded SQLite Database (./data/optimizer.db)        │
│   • PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;               │
│   • Tables: users, user_skills, nodes (1°/2°/3°), edges (weights)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 1. Multiplicative Path Reachability via Logarithmic Dijkstra

Edge weights $w \in [0.05, 0.99]$ represent connection trust and warm intro likelihood. To compute the optimal multi-hop warm introduction path, edge weights are converted into logarithmic friction costs:

$$c(e) = -\ln(w_e)$$

Dijkstra’s additive shortest path algorithm minimizes the sum of friction costs along route $\mathcal{R} = (v_0, v_1, \dots, v_k)$:

$$\text{Cost}(\mathcal{R}) = \sum_{i=0}^{k-1} c(e_i) = -\sum_{i=0}^{k-1} \ln(w_i) = -\ln\left(\prod_{i=0}^{k-1} w_i\right)$$

Inverting the accumulated cost restores the **true multiplicative probability of warm reachability**:

$$P(\text{Reach } v) = \exp(-\text{Cost}(\mathcal{R})) \times 100\% = \left(\prod_{i=0}^{k-1} w_i\right) \times 100\%$$

*Example*: A 2-hop route with edge weights $w_1 = 0.90$ and $w_2 = 0.85$ yields $c_1 = 0.1054$, $c_2 = 0.1625$, $\text{Total Cost} = 0.2679$.  
$\exp(-0.2679) = 0.765 = 76.5\%$, matching $0.90 \times 0.85$ exactly.

---

### 2. Expected Career Value ($EV$) Formula

Every 2nd- and 3rd-degree target is dynamically ranked using the multi-factor Expected Value equation:

$$\text{EV}(v) = P(\text{Reach } v) \times \text{Authority}(v) \times \text{SkillSynergy}(\text{You}, v) \times \text{GoalModeBoost}(v)$$

| Factor | Calculation | Purpose |
| :--- | :--- | :--- |
| **$P(\text{Reach } v)$** | $\exp(-\sum c_i) \in [8\%, 98\%]$ | Multiplicative probability through 1st/2nd-degree bridges |
| **$\text{Authority}(v)$** | $\text{IC} = 0.5$, $\text{Staff/Principal} = 0.8$, $\text{Director/VP/Founder} = 1.0$ | Weights decision-making power and hiring sponsorship |
| **$\text{SkillSynergy}$** | $0.68 + \min(0.55, |\text{shared}| \times 0.16 \times \frac{\bar{p}}{92})$ | Cosine/overlap boost from shared technical pillars |
| **$\text{GoalModeBoost}$** | Adaptive multiplier based on active vector | Emphasizes trajectory k-NN, lab targets, or structural holes |

---

### 3. Four Dynamic Goal Modes

Users can toggle the EV Engine between 4 operational modes at any time:

1. **Trajectory Lookahead (k-NN)**:
   Prioritizes targets whose historical career snapshot 3 years ago ($S_{t-3}$) mirrors your current technical stack ($S_0$) and who are now 1–2 levels ahead.
2. **Company / Lab Infiltration**:
   Maximizes decision-maker authority (1.0x) and prioritizes key leaders inside target frontier organizations (Tesla, Figure, OpenAI, Apple, Anthropic, NVIDIA).
3. **Technical Stack Gravity**:
   Prioritizes Staff/Principal architects with deep overlap in your core open-source repositories and specific tech pillars (e.g., ONNX graph chunking, Apple MLX, C++/Tauri).
4. **Structural Hole Bridging**:
   Optimizes for Ronald Burt’s Structural Holes—surfacing high-centrality targets in disconnected or underrepresented network clusters to maximize serendipity.

---

### 4. Highest-Leverage Bridge Conditioning ($\Delta\text{EV}$)

Strengthening a single 1st-degree connection (e.g., grabbing coffee, reviewing a PR) improves paths to *multiple* downstream targets. The engine simulates boosting each 1st-degree connector by $+0.25$ trust (up to $0.98$):

$$\Delta\text{EV}(u) = \sum_{t \in \text{Targets}} \text{EV}_{\text{boosted}}(t) - \sum_{t \in \text{Targets}} \text{EV}_{\text{baseline}}(t)$$

The UI ranks your 1st-degree bridges by $\Delta\text{EV}$ and provides a 1-click **"Simulate +0.25 Boost"** button for instant recalculation.

---

### 5. Ronald Burt Structural Hole Index

Measures information arbitrage potential across the 4 network clusters:

$$\text{HoleScore}(C) = \min\left(98, \; \frac{|\text{Targets}_C| \times 22}{\max(0.7, |\text{FirstDegree}_C|)} + |\text{ExternalBridges}_C| \times 4\right)$$

High scores flag clusters with dense 2nd/3rd-degree opportunities but few direct 1st-degree conduits.

---

### 6. Automated Trust Scoring ($T_i \in [0.15, 0.98]$)

When parsing LinkedIn archives or CSV contacts, trust is calculated automatically from interaction volume, message recency, and coworker overlap:

$$T_i = \min\left(0.98, \; 0.25 + 0.35 \cdot \frac{\ln(1 + \text{msg})}{\ln(50)} + 0.25 \cdot e^{-0.005 \Delta t_{\text{days}}} + 0.15 \cdot \mathbb{I}_{\text{coworker}}\right)$$

---

## 🖥️ Core UI Modules & Tabs

```
[Command Center]  [Goal & Target Discovery]  [Network Graph]  [Path & Outreach]  [DB, CSV & SQLite]
```

### 1. Command Center
- **4-Mode EV Selector Bar**: Live formula badges and instant re-ranking.
- **Executive Career Vector Banner**: S_0 focus, repositories, and weighted technical stack pills.
- **EV Target Ranking**: Shows decomposed formula badges (`Authority`, `k-NN Match`, `Synergy Factor`, `3Yrs Ago Snapshot`).
- **$\Delta\text{EV}$ Conditioning Leaderboard**: Surfaces which 1st-degree contact unlocks the most downstream value.

### 2. Goal & Target Discovery Engine
- **Sub-Engine A (k-NN Trajectory Lookahead)**: Analyzes $S_0 \to S_{t-3}$ transitions across 3 vector horizons (18–36 months).
- **Sub-Engine B (GitHub + LinkedIn Outbound Synthesizer)**: Cross-references stargazers and contributors across `onnx-model-chunking`, `lemon-mlx-engine`, `loom`, and `lemonade` with your 1st-degree LinkedIn bridges. Click **"Inject 2° Target"** to wire them into the live graph.
- **Sub-Engine C (Structural Holes Matrix)**: Real-time Burt Opportunity Index across the 4 industry clusters.

### 3. Interactive Concentric Network Graph
- **Concentric Orbital Topology**:
  - Center: **You** (0° Degree).
  - Orbit 1: **1st-Degree Bridges** ($r = 135\text{px}$).
  - Orbit 2: **2nd-Degree Targets** ($r = 245\text{px}$).
  - Orbit 3: **3rd-Degree Strategic Partners** ($r = 335\text{px}$).
- **Interactive Controls**: Zoom (65%–160%), click-and-drag canvas panning, cluster vs. degree color modes, edge weight labels, and node inspection drawer with live trust slider.

### 4. Path Calculator & Outreach Synthesizer
- **Dual Route Redundancy**: Automatically calculates **Primary Route #1** and discovers an independent **Backup Route #2** avoiding the primary bridge node.
- **Hop-by-Hop Friction Breakdown**: Visual breakdown of edge weights and log costs $(- \ln w)$.
- **Adaptive Outreach Synthesizer**: Generates 3 types of customizable outreach:
  - **Double-Opt-In Forwardable Blurb**: Ready for your bridge contact to forward.
  - **Bridge Ask Message**: Asks your 1st-degree contact for an intro with zero cognitive friction.
  - **Direct Warm DM**: For direct reach-outs citing mutual connections and shared repos.

### 5. Unified Database, CSV Ingestion & SQLite Export
- **Contacts & Edges Tables**: Full search, filtering by degree, inline trust slider, and editing modals.
- **Drag-and-Drop LinkedIn CSV Importer**: Parses `Connections.csv` and auto-wires 2nd-degree insider bridges to targets at the same companies.
- **4-Stage Ingestion Simulator**: One-click test pipeline without needing a live LinkedIn archive.
- **Live SQLite `seed.sql` & JSON Exporter**: Generates transactional SQL or downloads `cno_db_v3.json` for one-click backup and database hydration.

---

## 🗄️ Database Schema (`backend/app/schema.sql`)

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. User Profiles & Career Vectors
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    headline TEXT,
    current_company TEXT,
    target_roles_json TEXT DEFAULT '[]',
    target_companies_json TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Technical Stack & Competencies
CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    category TEXT,
    proficiency INTEGER DEFAULT 80,
    UNIQUE(user_id, skill_name)
);

-- 3. Multi-Degree Network Nodes (1°, 2°, 3°)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT,
    company TEXT,
    location TEXT,
    degree INTEGER NOT NULL CHECK (degree IN (0, 1, 2, 3)),
    trust_score REAL DEFAULT 0.5,
    strategic_value INTEGER DEFAULT 50,
    authority_level TEXT DEFAULT 'Staff/Principal',
    cluster TEXT DEFAULT 'Robotics & Embodied AI',
    skills_json TEXT DEFAULT '[]',
    past_role_3yrs_ago TEXT,
    github_overlap TEXT,
    connected_on DATE,
    message_count INTEGER DEFAULT 0,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Weighted Directed/Undirected Edges
CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    weight REAL NOT NULL DEFAULT 0.5,
    relationship_type TEXT DEFAULT 'linkedin_1st',
    context TEXT,
    UNIQUE(user_id, source_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_nodes_user_company ON nodes(user_id, company);
CREATE INDEX IF NOT EXISTS idx_edges_lookup ON edges(user_id, source_id, target_id);
```

---

## 🧪 Verification & Testing

Run the full end-to-end test suite across backend and frontend:

```powershell
# 1. Run Backend Integration Tests
.\.venv\Scripts\python backend\test_app.py

# 2. Run Frontend Type-Check & Production Build
npm --prefix frontend run build
```

Expected output:
```text
==> Seeding database...
==> Testing /api/health... (Health OK)
==> Testing /api/users/default_user... (Profile OK)
==> Testing /api/graph/default_user... (Graph OK: 21 nodes, 32 edges, 8 Dijkstra paths)
==> Testing /api/outreach/... (Outreach OK)
==> Testing POST /api/ingest/linkedin... (Ingestion OK)
[ALL TESTS PASSED SUCCESSFULLY!]

✓ built in 2.44s
```

---

## 📁 Repository Directory Structure

```text
NetworkOptimizer/
├── README.md                    # Comprehensive documentation & mathematical specification
├── Makefile                     # Cross-platform orchestration (setup, dev, test)
├── docker-compose.yml           # Multi-container orchestration
├── career_network_optimizer.tsx # Standalone root component copy
├── data/                        # Local SQLite storage (git-ignored)
│   ├── optimizer.db             # Live SQLite database (WAL mode)
│   ├── seed.sql                 # Pure SQL transaction script for database hydration
│   └── imports/                 # Drop folder for LinkedIn export ZIP / CSVs
│       └── sample_linkedin_archive.zip
├── backend/
│   ├── requirements.txt         # FastAPI, networkx, pydantic, sqlite-utils, uvicorn
│   ├── test_app.py              # Backend integration test suite
│   └── app/
│       ├── main.py              # FastAPI REST & WebSocket endpoints
│       ├── db.py                # Database connection & migration manager
│       ├── schema.sql           # Hybrid relational + graph DDL
│       ├── seed.py              # Synthetic seed generator
│       ├── engine/
│       │   ├── pathfinder.py    # Logarithmic Dijkstra & Betweenness Centrality
│       │   └── matcher.py       # Technical stack cosine & Jaccard matcher
│       └── ingest/
│           └── linkedin_zip.py  # 3-Stage LinkedIn archive & CSV parser
└── frontend/
    ├── package.json
    ├── vite.config.ts           # Reverse proxy to backend (:8000)
    ├── tailwind.config.js
    └── src/
        ├── App.tsx              # Application root
        ├── main.tsx             # Entry point
        ├── index.css            # Tailwind stylesheets
        └── CareerNetworkOptimizer.tsx # Comprehensive 4,017-line reactive UI engine
```

---

## 📄 License

MIT License. Designed and engineered for high-agency technical leaders and builders.
