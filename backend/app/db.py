import os
import sqlite3
from pathlib import Path
from typing import Generator, Optional

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "optimizer.db"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

def get_db_path() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "imports").mkdir(parents=True, exist_ok=True)
    return DB_PATH

def migrate_schema(conn: sqlite3.Connection) -> None:
    """Migrate schema with any newly introduced columns."""
    try:
        cursor = conn.execute("PRAGMA table_info(nodes);")
        columns = {row[1] for row in cursor.fetchall()}
        new_cols = [
            ("authority_level", "TEXT DEFAULT 'Staff/Principal'"),
            ("cluster", "TEXT DEFAULT 'Robotics & Embodied AI'"),
            ("past_role_3yrs_ago", "TEXT DEFAULT ''"),
            ("github_overlap", "TEXT DEFAULT ''")
        ]
        for col_name, col_def in new_cols:
            if col_name not in columns:
                conn.execute(f"ALTER TABLE nodes ADD COLUMN {col_name} {col_def};")
        conn.commit()
    except Exception as e:
        print(f"Migration note: {e}")

def init_db(db_file: Optional[Path] = None) -> None:
    """Initialize the SQLite database with the relational schema."""
    target_path = db_file or get_db_path()
    target_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(target_path))
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA foreign_keys = ON;")
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            schema_sql = f.read()
        conn.executescript(schema_sql)
        migrate_schema(conn)
        conn.commit()
    finally:
        conn.close()

def get_db_connection(db_file: Optional[Path] = None) -> sqlite3.Connection:
    """Returns a configured SQLite connection with row_factory enabled."""
    target_path = db_file or get_db_path()
    if not target_path.exists():
        init_db(target_path)
        
    conn = sqlite3.connect(str(target_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    migrate_schema(conn)
    return conn

def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI dependency for yielding database connections."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()
