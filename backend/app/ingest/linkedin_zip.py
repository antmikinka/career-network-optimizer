import io
import csv
import zipfile
import math
import json
import hashlib
import sqlite3
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Callable, Union

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.db import get_db_connection, DB_PATH
from app.seed import ensure_user_profile
from app.engine.matcher import compute_node_strategic_value
from app.engine.recalculations import registry

DEFAULT_LAMBDA = math.log(2) / 180.0  # 180-day half-life decay


def compute_trust_score(
    msg_count: int,
    delta_days: Optional[float],
    is_coworker: bool,
    decay_lambda: float = DEFAULT_LAMBDA,
) -> float:
    """
    Computes automated relationship trust score:
    T_i = min(0.98, 0.25 + 0.35 * (ln(1 + msg_count) / ln(50)) + 0.25 * exp(-lambda * delta_days) + 0.15 * I_coworker)
    """
    base = 0.25
    msg_component = 0.35 * (math.log(1 + max(0, msg_count)) / math.log(50))
    recency_component = 0.25 * math.exp(-decay_lambda * max(0.0, delta_days)) if delta_days is not None else 0.12
    coworker_component = 0.15 if is_coworker else 0.0

    trust = base + msg_component + recency_component + coworker_component
    return round(min(0.98, max(0.15, trust)), 2)


def classify_contact_attributes(role: str, company: str) -> Dict[str, Any]:
    """Classifies cluster, decision authority tier, and technical skills from real position & company."""
    combined = f"{role} {company}".lower()

    if any(k in combined for k in ("vp", "vice president", "director", "head ", "founder", "co-founder", "cto", "ceo", "partner", "chief", "managing")):
        authority_level = "Director/VP/Founder"
    elif any(k in combined for k in ("staff", "principal", "lead", "architect", "distinguished", "fellow", "sr.", "senior", "manager")):
        authority_level = "Staff/Principal"
    else:
        authority_level = "IC"

    if any(k in combined for k in ("venture", "capital", "partner", "founder", "ceo", "investor")):
        cluster = "Frontier Execs & Venture"
    elif any(k in combined for k in ("robot", "optimus", "humanoid", "embodied", "autonom", "teleop", "figure", "kinematic", "control", "mechatronic")):
        cluster = "Robotics & Embodied AI"
    elif any(k in combined for k in ("onnx", "mlx", "compiler", "runtime", "inference", "coreml", "tensorrt", "cuda", "kernel", "edge", "model", "ai", "ml", "learning")):
        cluster = "Edge ML & Runtimes"
    else:
        cluster = "Data Platform & Infra"

    inferred_skills: List[str] = []
    if any(k in combined for k in ("robot", "optimus", "humanoid", "embodied", "teleop", "autonom")):
        inferred_skills.append("Humanoid Robotics Telemetry & Data Ops")
    if any(k in combined for k in ("data", "platform", "pipeline", "infra", "distributed", "lingo", "telemetry", "cloud", "backend")):
        inferred_skills.append("Distributed Data Platform Architecture")
    if any(k in combined for k in ("onnx", "runtime", "compiler", "inference", "graph", "quantiz")):
        inferred_skills.append("ONNX Runtime & Graph Chunking")
    if any(k in combined for k in ("mlx", "apple", "coreml", "silicon", "metal", "gpu", "cuda", "ml", "ai")):
        inferred_skills.append("MLX Inference Acceleration")
    if any(k in combined for k in ("c++", "rust", "tauri", "systems", "embedded", "firmware", "software")):
        inferred_skills.append("C++ & Tauri GUI Systems")
    if any(k in combined for k in ("test", "qa", "validation", "eval", "simulation", "hil", "hardware")):
        inferred_skills.append("Automated Test Execution / Loom")

    if not inferred_skills:
        inferred_skills.append("Distributed Data Platform Architecture")

    return {
        "authority_level": authority_level,
        "cluster": cluster,
        "skills": inferred_skills,
    }


def _parse_csv_text_with_header_detection(raw_text: str) -> List[Dict[str, str]]:
    """Parses CSV text while automatically skipping LinkedIn's top 1-4 disclaimer lines."""
    raw_text = raw_text.lstrip("\ufeff")
    lines = raw_text.splitlines()
    if not lines:
        return []

    start_idx = 0
    for i, line in enumerate(lines[:12]):
        clean = line.strip().lower()
        if (
            ("first name" in clean and "last name" in clean)
            or ("name" in clean and "company" in clean)
            or "conversation id" in clean
            or "company name" in clean
        ):
            start_idx = i
            break

    csv_data = "\n".join(lines[start_idx:])
    reader = csv.DictReader(io.StringIO(csv_data))
    rows = []
    for row in reader:
        normalized = {(k or "").strip(): (v or "").strip() for k, v in row.items() if k}
        if any(normalized.values()):
            rows.append(normalized)
    return rows


def _parse_flexible_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    clean = date_str.split(".")[0].replace(" UTC", "").strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d %b %Y",
        "%d %B %Y",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y",
    ):
        try:
            return datetime.strptime(clean, fmt).replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None


class LinkedInArchiveParser:
    def __init__(
        self,
        db_conn: sqlite3.Connection,
        user_id: str,
        log_cb: Optional[Callable[[str], None]] = None,
    ):
        self.conn = db_conn
        self.user_id = user_id
        self.log_cb = log_cb or (lambda msg: None)

    def log(self, message: str):
        self.log_cb(message)

    def _read_csv_from_zip(self, zf: zipfile.ZipFile, possible_names: List[str]) -> Optional[List[Dict[str, str]]]:
        namelist = zf.namelist()
        matched_filename = None
        for target in possible_names:
            for name in namelist:
                if target.lower() in name.lower() and name.lower().endswith(".csv"):
                    matched_filename = name
                    break
            if matched_filename:
                break

        if not matched_filename:
            return None

        with zf.open(matched_filename) as f:
            raw_text = f.read().decode("utf-8", errors="replace")
        return _parse_csv_text_with_header_detection(raw_text)

    def parse_input(self, source: Union[str, Path, bytes, io.BytesIO], filename: str = "upload.csv") -> Dict[str, Any]:
        """
        Accepts EITHER a LinkedIn `.zip` export archive OR a standalone `.csv` (`Connections.csv`).
        Zero synthetic/fake contacts are created.
        """
        ensure_user_profile(self.conn, self.user_id)

        raw_bytes: bytes
        if isinstance(source, (str, Path)):
            p = Path(source)
            filename = p.name
            raw_bytes = p.read_bytes()
        elif isinstance(source, io.BytesIO):
            raw_bytes = source.getvalue()
        else:
            raw_bytes = source

        is_zip = filename.lower().endswith(".zip") or zipfile.is_zipfile(io.BytesIO(raw_bytes))

        positions_rows: Optional[List[Dict[str, str]]] = None
        messages_rows: Optional[List[Dict[str, str]]] = None
        connections_rows: Optional[List[Dict[str, str]]] = None

        if is_zip:
            self.log("Opening LinkedIn archive ZIP container...")
            with zipfile.ZipFile(io.BytesIO(raw_bytes), "r") as zf:
                positions_rows = self._read_csv_from_zip(zf, ["Positions", "profile/Positions"])
                messages_rows = self._read_csv_from_zip(zf, ["messages", "message"])
                connections_rows = self._read_csv_from_zip(zf, ["Connections", "Connections.csv"])
        else:
            self.log(f"Parsing standalone CSV file '{filename}'...")
            text = raw_bytes.decode("utf-8", errors="replace")
            connections_rows = _parse_csv_text_with_header_detection(text)

        if not connections_rows:
            raise ValueError("No valid contact rows found. Upload a LinkedIn Connections.csv or data export .zip.")

        return self._ingest_rows(connections_rows, messages_rows, positions_rows)

    # Keep parse_archive alias for backward compatibility
    def parse_archive(self, zip_source: Any) -> Dict[str, Any]:
        return self.parse_input(zip_source, filename="archive.zip")

    def _ingest_rows(
        self,
        connections_rows: List[Dict[str, str]],
        messages_rows: Optional[List[Dict[str, str]]],
        positions_rows: Optional[List[Dict[str, str]]],
    ) -> Dict[str, Any]:
        now_dt = datetime.now(timezone.utc)

        user_row = self.conn.execute("SELECT * FROM users WHERE id = ?", (self.user_id,)).fetchone()
        user_dict = dict(user_row) if user_row else {}
        target_companies = json.loads(user_dict.get("target_companies_json") or "[]")
        target_roles = json.loads(user_dict.get("target_roles_json") or "[]")
        skills_rows = self.conn.execute("SELECT * FROM user_skills WHERE user_id = ?", (self.user_id,)).fetchall()
        user_skills = [dict(r) for r in skills_rows]

        user_companies = set()
        if user_dict.get("current_company"):
            user_companies.add(user_dict["current_company"].strip().lower())

        if positions_rows:
            self.log(f"Parsed {len(positions_rows)} career history entries for coworker overlap...")
            for row in positions_rows:
                comp = row.get("Company Name") or row.get("Company") or ""
                if comp.strip():
                    user_companies.add(comp.strip().lower())

        msg_counts: Dict[str, int] = {}
        msg_last_date: Dict[str, datetime] = {}

        if messages_rows:
            self.log(f"Scoring interaction recency across {len(messages_rows)} archived messages...")
            for row in messages_rows:
                sender = (row.get("FROM") or row.get("Sender") or "").strip().lower()
                recipients = (row.get("TO") or row.get("Recipient") or "").strip().lower()
                date_str = (row.get("DATE") or row.get("Date") or "").strip()
                dt = _parse_flexible_date(date_str)

                for participant in [sender] + recipients.split(";"):
                    p = participant.strip()
                    if not p:
                        continue
                    msg_counts[p] = msg_counts.get(p, 0) + 1
                    if dt and (p not in msg_last_date or dt > msg_last_date[p]):
                        msg_last_date[p] = dt

        root_id = f"{self.user_id}_root"
        created_or_updated = 0
        edges_upserted = 0

        for row in connections_rows:
            lower_map = {k.lower().strip(): v for k, v in row.items()}
            first_name = lower_map.get("first name", "").strip()
            last_name = lower_map.get("last name", "").strip()
            full_name = lower_map.get("name", "").strip() or f"{first_name} {last_name}".strip()
            if not full_name:
                continue

            company = lower_map.get("company") or lower_map.get("organization") or "Independent"
            position = lower_map.get("position") or lower_map.get("role") or lower_map.get("title") or "Engineer"
            url = lower_map.get("url") or lower_map.get("linkedin url") or ""
            location = lower_map.get("location") or "Bay Area, CA"
            connected_raw = lower_map.get("connected on") or ""
            explicit_msgs = lower_map.get("messages") or lower_map.get("message_count") or lower_map.get("messagecount")

            conn_dt = _parse_flexible_date(connected_raw)
            iso_connected = conn_dt.strftime("%Y-%m-%d") if conn_dt else connected_raw

            # Deterministic message count (NEVER random!)
            m_count = int(explicit_msgs) if (explicit_msgs and explicit_msgs.isdigit()) else 0
            lookup_keys = [full_name.lower(), url.lower()]
            for k in lookup_keys:
                if k and k in msg_counts:
                    m_count = max(m_count, msg_counts[k])

            m_dt = None
            for k in lookup_keys:
                if k and k in msg_last_date:
                    if m_dt is None or msg_last_date[k] > m_dt:
                        m_dt = msg_last_date[k]

            ref_dt = m_dt or conn_dt
            delta_days = (now_dt - ref_dt).total_seconds() / 86400.0 if ref_dt else None
            last_interaction_iso = m_dt.strftime("%Y-%m-%d") if m_dt else ""

            is_coworker = bool(
                company
                and any(uc in company.lower() or company.lower() in uc for uc in user_companies if uc)
            )
            trust = compute_trust_score(m_count, delta_days, is_coworker)

            attrs = classify_contact_attributes(position, company)
            strat_val = compute_node_strategic_value(
                company, position, attrs["skills"], target_companies, target_roles, user_skills
            )

            # Deterministic ID per (user_id, full_name, company) to prevent duplicate rows on re-import
            digest = hashlib.sha1(f"{self.user_id}:{full_name.lower()}:{company.lower()}".encode("utf-8")).hexdigest()[:10]
            node_id = f"{self.user_id}_li_{digest}"

            ctx_parts = []
            if m_count > 0:
                ctx_parts.append(f"{m_count} archived DMs")
            else:
                ctx_parts.append("LinkedIn 1st-degree connection")
            if is_coworker:
                ctx_parts.append(f"Colleague overlap ({company})")
            context_text = " • ".join(ctx_parts)

            self.conn.execute(
                """
                INSERT INTO nodes (
                    id, user_id, full_name, role, company, location, degree,
                    trust_score, strategic_value, authority_level, cluster,
                    skills_json, linkedin_url, connected_on, last_interaction_at,
                    message_count, notes
                ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    role = excluded.role,
                    company = excluded.company,
                    trust_score = excluded.trust_score,
                    strategic_value = excluded.strategic_value,
                    authority_level = excluded.authority_level,
                    cluster = excluded.cluster,
                    skills_json = excluded.skills_json,
                    linkedin_url = CASE WHEN excluded.linkedin_url != '' THEN excluded.linkedin_url ELSE nodes.linkedin_url END,
                    connected_on = CASE WHEN excluded.connected_on != '' THEN excluded.connected_on ELSE nodes.connected_on END,
                    last_interaction_at = CASE WHEN excluded.last_interaction_at != '' THEN excluded.last_interaction_at ELSE nodes.last_interaction_at END,
                    message_count = MAX(nodes.message_count, excluded.message_count),
                    notes = excluded.notes,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    node_id,
                    self.user_id,
                    full_name,
                    position,
                    company,
                    location,
                    trust,
                    strat_val,
                    attrs["authority_level"],
                    attrs["cluster"],
                    json.dumps(attrs["skills"]),
                    url,
                    iso_connected,
                    last_interaction_iso,
                    m_count,
                    context_text,
                ),
            )

            self.conn.execute(
                """
                INSERT INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
                VALUES (?, ?, ?, ?, 'linkedin_1st', ?)
                ON CONFLICT(user_id, source_id, target_id) DO UPDATE SET
                    weight = excluded.weight,
                    context = excluded.context
                """,
                (self.user_id, root_id, node_id, trust, context_text),
            )
            created_or_updated += 1
            edges_upserted += 1

        self.conn.commit()

        # Run real topology inference & recalculation pipeline (wires bridges to existing real 2nd-degree targets, computes centrality & EV)
        self.log("Running modular topology & EV recalculation pipeline...")
        pipeline_summary = registry.run_pipeline(
            self.conn,
            self.user_id,
            ["bridge_synthesis", "knn_trajectory", "centrality", "ev", "delta_ev"],
        )

        bridge_res = next(
            (r for r in pipeline_summary["results"] if r["processor_id"] == "bridge_synthesis"),
            None,
        )
        bridges_wired = bridge_res["edges_updated"] if bridge_res else 0
        second_deg_total = self.conn.execute(
            "SELECT COUNT(*) AS c FROM nodes WHERE user_id = ? AND degree >= 2",
            (self.user_id,),
        ).fetchone()["c"]
        total_edges = self.conn.execute(
            "SELECT COUNT(*) AS c FROM edges WHERE user_id = ?",
            (self.user_id,),
        ).fetchone()["c"]

        self.log(
            f"Import complete: {created_or_updated} 1st-degree contacts synced, {bridges_wired} company-overlap bridges wired."
        )

        return {
            "first_degree_count": created_or_updated,
            "second_degree_count": second_deg_total,
            "bridges_synthesized": bridges_wired,
            "edges_count": total_edges,
            "user_id": self.user_id,
            "pipeline_time_ms": pipeline_summary["total_execution_time_ms"],
        }


def run_cli_import():
    parser = argparse.ArgumentParser(description="Ingest LinkedIn Connections.csv or Archive .zip into SQLite.")
    parser.add_argument("--file", required=True, help="Path to LinkedIn Connections.csv or export .zip")
    parser.add_argument("--user-id", default="default_user", help="User ID to attach connections to")
    parser.add_argument("--db", default=str(DB_PATH), help="Path to optimizer.db")
    args = parser.parse_args()

    conn = get_db_connection(Path(args.db))
    try:
        parser_obj = LinkedInArchiveParser(conn, args.user_id, log_cb=print)
        results = parser_obj.parse_input(Path(args.file))
        print("\nImport Summary:")
        print(f"  1st-degree contacts synced: {results['first_degree_count']}")
        print(f"  2nd/3rd-degree targets:     {results['second_degree_count']}")
        print(f"  Company bridges wired:      {results['bridges_synthesized']}")
        print(f"  Total graph edges:          {results['edges_count']}")
    finally:
        conn.close()


if __name__ == "__main__":
    run_cli_import()
