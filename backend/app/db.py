import sqlite3
from pathlib import Path
from typing import Generator, Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "optimizer.db"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

_INITIALIZED_DBS: set[str] = set()


def get_db_path() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "imports").mkdir(parents=True, exist_ok=True)
    return DB_PATH


def migrate_schema(conn: sqlite3.Connection) -> None:
    """Idempotently add any columns introduced across schema revisions."""
    user_cols = {row[1] for row in conn.execute("PRAGMA table_info(users);").fetchall()}
    user_additions = [
        ("location", "TEXT DEFAULT 'San Jose, CA'"),
        ("active_goal_mode", "TEXT DEFAULT 'trajectory'"),
        ("active_career_vector", "TEXT DEFAULT 'Principal Embodied AI & Humanoid Data Architect'"),
        ("repositories_json", "TEXT DEFAULT '[]'"),
        ("updated_at", "TEXT DEFAULT ''"),
    ]
    for col_name, col_def in user_additions:
        if col_name not in user_cols:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def};")

    node_cols = {row[1] for row in conn.execute("PRAGMA table_info(nodes);").fetchall()}
    node_additions = [
        ("authority_level", "TEXT DEFAULT 'Staff/Principal'"),
        ("cluster", "TEXT DEFAULT 'Robotics & Embodied AI'"),
        ("past_role_3yrs_ago", "TEXT DEFAULT ''"),
        ("knn_similarity", "INTEGER DEFAULT 0"),
        ("vector_cluster", "TEXT DEFAULT ''"),
        ("github_overlap", "TEXT DEFAULT ''"),
        ("betweenness_centrality", "REAL DEFAULT 0.0"),
        ("pagerank", "REAL DEFAULT 0.0"),
        ("ev_score", "INTEGER DEFAULT 0"),
        ("conversion_prob", "REAL DEFAULT 0.0"),
    ]
    for col_name, col_def in node_additions:
        if col_name not in node_cols:
            conn.execute(f"ALTER TABLE nodes ADD COLUMN {col_name} {col_def};")


def init_db(db_file: Optional[Path] = None) -> None:
    """Initialize SQLite database and run one-time schema migrations."""
    target_path = (db_file or get_db_path()).resolve()
    target_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(target_path), timeout=10.0)
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        conn.execute("PRAGMA foreign_keys = ON;")
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        migrate_schema(conn)
        conn.commit()
        _INITIALIZED_DBS.add(str(target_path))
    finally:
        conn.close()


def get_db_connection(db_file: Optional[Path] = None) -> sqlite3.Connection:
    """Returns a configured WAL SQLite connection without redundant per-request DDL."""
    target_path = (db_file or get_db_path()).resolve()
    if str(target_path) not in _INITIALIZED_DBS or not target_path.exists():
        init_db(target_path)

    conn = sqlite3.connect(str(target_path), check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency yielding SQLite connections."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
