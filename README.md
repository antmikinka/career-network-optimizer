# Nexus Career & Network Optimizer

> **A local-first career graph intelligence engine, Expected Career Value ($EV$) pathfinder, and goal-aware outreach synthesizer.**  
> Powered by an embedded **SQLite WAL relational-graph hybrid**, **FastAPI + NetworkX** modular recalculation pipelines, deterministic **LinkedIn `.zip` / `Connections.csv` ingestion**, live **GitHub REST API contributor/stargazer discovery**, and a strictly-typed **Vite + React + TypeScript** frontend.

[![FastAPI](https://img.shields.io/badge/FastAPI-2.0-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=flat&logo=sqlite)](https://sqlite.org)
[![NetworkX](https://img.shields.io/badge/NetworkX-8_Modular_Processors-blue?style=flat)](https://networkx.org)

---

## Quick Start

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**

### Windows (PowerShell)

```powershell
# 1. Install backend & frontend dependencies
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt
npm --prefix frontend install

# 2. Start FastAPI + SQLite WAL Backend (Terminal 1)
.\.venv\Scripts\uvicorn --app-dir backend app.main:app --host 127.0.0.1 --port 8000 --reload

# 3. Start Vite + React Frontend (Terminal 2)
npm --prefix frontend run dev
```

### macOS / Linux / WSL

```bash
make setup
make dev
```

### Docker Compose

```bash
docker-compose up --build
```

| Service | URL | Purpose |
| :--- | :--- | :--- |
| **Web Application** | `http://localhost:5173/` | Unified Graph UI, EV Pathfinder, Discovery & SQLite Console |
| **Backend Health** | `http://127.0.0.1:8000/api/health` | SQLite WAL status, node/edge counts & processor registry |
| **OpenAPI / Swagger** | `http://127.0.0.1:8000/docs` | Interactive REST API explorer |

---

## Architecture & Mathematical Formulation

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                  Vite + React + TypeScript UI (Port 5173)                │
│  • Binary Min-Heap Dijkstra O((V + E) log V) + Backup Route Finder       │
│  • O(1)-per-target Reverse-Dijkstra ΔEV Bridge Conditioning              │
│  • Adaptive Orbital SVG Renderer (scales to 1,000+ LinkedIn contacts)    │
│  • Bidirectional SQLite Sync + Debounced Slider Persistence + Offline Cache│
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ HTTP / WebSocket Proxy (127.0.0.1:8000)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      FastAPI + NetworkX Engine (Port 8000)               │
│  • 8 Pluggable Recalculation Processors (CLI + REST + UI Console)        │
│  • LinkedIn .zip (Connections + messages + Positions) & .csv Parser      │
│  • Live GitHub REST API Contributor & Stargazer Scanner                  │
│  • Canonical SQLite Seed Exporter + Live optimizer.db Binary Download    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                 Embedded SQLite WAL Database (./data/optimizer.db)       │
│  • Zero synthetic placeholders — initialized cleanly with user root node │
│  • Tables: users, user_skills, nodes (0°/1°/2°/3°), edges                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1. Multiplicative Warm Reachability via Logarithmic Dijkstra
Each edge $e = (u, v)$ carries relationship weight $w_e \in [0.05, 0.99]$, mapped to additive logarithmic friction cost:

$$c(e) = -\ln(w_e)$$

Minimizing path friction along $\mathcal{R} = (v_0, v_1, \dots, v_k)$ maximizes exact multiplicative conversion probability:

$$\text{Cost}(\mathcal{R}) = \sum_{i=0}^{k-1} -\ln(w_i) \implies P(\text{Reach } v) = \exp(-\text{Cost}(\mathcal{R})) = \prod_{i=0}^{k-1} w_i$$

A distinct-bridge **Backup Route #2** is computed by excluding the primary 1st-degree bridge edge and re-running Min-Heap Dijkstra.

### 2. Expected Career Value ($EV$) & 4 Dynamic Goal Modes
Every reachable 2nd- and 3rd-degree target $v$ is scored via:

$$\text{EV}(v) = P(\text{Reach } v) \times \left(0.55 + 0.45 \cdot \text{Authority}(v)\right) \times \text{SkillSynergy}(\text{You}, v) \times \text{GoalModeBoost}(v) \times 100$$

- **Trajectory Lookahead (`trajectory`)**: Weights 3-year historical progression similarity ($S_0$ vs. $S_{t-3}$).
- **Company / Lab Infiltration (`infiltration`)**: Boosts decision authority (`Director/VP/Founder = 1.0x`) inside target organizations.
- **Technical Stack Gravity (`gravity`)**: Boosts weighted cosine skill synergy and open-source GitHub overlap.
- **Structural Hole Bridging (`structural`)**: Rewards underrepresented target clusters and cross-cluster bridge jumps (Ronald Burt's Structural Holes).

### 3. $O(1)$ Reverse-Dijkstra $\Delta\text{EV}$ Bridge Conditioning
Instead of re-running pathfinding per bridge per target ($O(N_1 \cdot |T| \cdot V!)$), the engine precomputes reverse shortest-path trees from each target $t \in T$ in $G \setminus \{v_0\}$. Evaluating a $+0.25$ trust boost on any 1st-degree bridge $b$ resolves in **$O(1)$ time per target**:

$$\text{Cost}'(v_0 \to t \text{ via } b) = -\ln(\min(0.98, w_{0,b} + 0.25)) + d_{G \setminus \{v_0\}}(b, t)$$

### 4. Automated Interaction Trust Decay
When ingesting LinkedIn archives (`Connections.csv` + `messages.csv` + `Positions.csv`), trust scores are computed deterministically with a configurable half-life $T_{1/2}$ (default 180 days, $\lambda = \ln 2 / T_{1/2}$):

$$T_i = \min\left(0.98, \; 0.25 + 0.35 \cdot \frac{\ln(1 + \text{msg}_i)}{\ln(50)} + 0.25 \cdot e^{-\lambda \Delta t_{\text{days}}} + 0.15 \cdot \mathbb{I}_{\text{coworker}}\right)$$

---

## Modular Recalculations & Processing Pipeline

All 8 analytical processors live in `backend/app/engine/recalculations/` and update `data/optimizer.db` atomically:

| ID | Processor | Function |
| :--- | :--- | :--- |
| `trust` | `TrustRecalculator` | Recomputes 1st-degree trust & root edge weights using half-life decay and coworker overlap |
| `bridge_synthesis` | `CompanyBridgeSynthesizer` | Wires insider bridge edges between 1st-degree contacts and 2nd/3rd-degree targets at matching companies |
| `synergy` | `SkillSynergyProcessor` | Computes cosine & token-overlap technical synergy and updates `strategic_value` |
| `knn_trajectory` | `KNNTrajectoryProcessor` | Scores $S_0$ vs. $S_{t-3}$ career trajectory similarity and assigns career vectors |
| `centrality` | `CentralityProcessor` | Persists log-friction Betweenness Centrality $C_B(v)$ and conductance PageRank |
| `structural_holes` | `StructuralHolesProcessor` | Computes Ronald Burt's Opportunity Index and cross-cluster bridge counts |
| `ev` | `EVProcessor` | Evaluates multi-hop Dijkstra reachability and persists `ev_score` & `conversion_prob` |
| `delta_ev` | `DeltaEVProcessor` | Ranks 1st-degree connectors by marginal network $\Delta\text{EV}$ unlocked |

### Run via CLI
```powershell
# List all registered modules and tunable parameters
.\.venv\Scripts\python backend\recalculate.py --list

# Execute full 8-module pipeline
.\.venv\Scripts\python backend\recalculate.py --user default_user

# Execute specific modules with custom JSON hyperparameters
.\.venv\Scripts\python backend\recalculate.py --user default_user --processors trust centrality ev --params "{\"trust\": {\"half_life_days\": 90}}"
```

---

## Verification & Testing

Tests execute against an isolated temporary SQLite database so your live `./data/optimizer.db` is never modified:

```powershell
# 1. End-to-end backend & 8-processor verification
.\.venv\Scripts\python backend\test_app.py

# 2. Strict TypeScript type-check & production Vite bundle
npm --prefix frontend run build
```

---

## Repository Structure

```text
NetworkOptimizer/
├── README.md
├── Makefile
├── docker-compose.yml
├── data/
│   ├── optimizer.db                       # Live SQLite WAL database (git-ignored)
│   └── seed.sql                           # Canonical zero-placeholder SQLite seed script
├── backend/
│   ├── requirements.txt
│   ├── recalculate.py                     # Modular CLI pipeline runner
│   ├── test_app.py                        # Isolated end-to-end test suite
│   └── app/
│       ├── main.py                        # FastAPI v2 REST + WebSocket server
│       ├── db.py                          # SQLite WAL connection & idempotent migrations
│       ├── schema.sql                     # Relational + graph adjacency DDL
│       ├── seed.py                        # Clean user root initializer (0 mock contacts)
│       ├── engine/
│       │   ├── pathfinder.py              # NetworkX Dijkstra & outreach blurbs
│       │   ├── matcher.py                 # Cosine & token similarity scoring
│       │   └── recalculations/            # 8 pluggable graph recalculation processors
│       └── ingest/
│           ├── linkedin_zip.py            # .zip & standalone Connections.csv parser
│           └── resume_parser.py           # Resume technical competency extractor
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx                        # Bidirectional SQLite sync & state orchestrator
        ├── api/client.ts                  # REST client + debounced persistence + offline cache
        ├── engine/graphEngine.ts          # Min-Heap Dijkstra, Reverse-Dijkstra ΔEV & EV math
        ├── types/graph.ts                 # Strict TypeScript domain interfaces
        └── components/                    # CommandCenter, GoalDiscoveryView, NetworkGraph,
                                           # PathCalculator, DatabaseIngestView, Modals
```

---

## License

MIT License.
