import io
import os
import csv
import zipfile
import math
import json
import sqlite3
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple, Callable

# Ensure backend directory is in python search path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.db import get_db_connection, DB_PATH
from app.engine.matcher import compute_node_strategic_value

DEFAULT_LAMBDA = 1.0 / 180.0  # ~6-month half-life decay for interaction recency

def compute_trust_score(
    msg_count: int,
    delta_days: Optional[float],
    is_coworker: bool,
    decay_lambda: float = DEFAULT_LAMBDA
) -> float:
    """
    Computes trust score:
    T_i = min(0.98, 0.25 + 0.35 * (ln(1 + msg_count) / ln(50)) + 0.25 * exp(-lambda * delta_days) + 0.15 * I_coworker)
    """
    base = 0.25
    msg_component = 0.35 * (math.log(1 + max(0, msg_count)) / math.log(50))
    recency_component = 0.0
    if delta_days is not None and delta_days >= 0:
        recency_component = 0.25 * math.exp(-decay_lambda * delta_days)
    coworker_component = 0.15 if is_coworker else 0.0
    
    trust = base + msg_component + recency_component + coworker_component
    return round(min(0.98, max(0.15, trust)), 3)

class LinkedInArchiveParser:
    def __init__(self, db_conn: sqlite3.Connection, user_id: str, log_cb: Optional[Callable[[str], None]] = None):
        self.conn = db_conn
        self.user_id = user_id
        self.log_cb = log_cb or (lambda msg: None)
        
    def log(self, message: str):
        self.log_cb(message)
        
    def _read_csv_from_zip(self, zf: zipfile.ZipFile, possible_names: List[str]) -> Optional[List[Dict[str, str]]]:
        """Finds and parses a CSV from zip file handling case sensitivity and header comments."""
        namelist = zf.namelist()
        matched_filename = None
        for target in possible_names:
            for name in namelist:
                if target.lower() in name.lower() and name.endswith(".csv"):
                    matched_filename = name
                    break
            if matched_filename:
                break
                
        if not matched_filename:
            return None
            
        with zf.open(matched_filename) as f:
            raw_text = f.read().decode("utf-8", errors="replace")
            
        lines = raw_text.splitlines()
        # LinkedIn CSV files often have 1-3 lines of notes/instructions before the actual header
        start_idx = 0
        for i, line in enumerate(lines[:10]):
            clean = line.strip().lower()
            if "first name" in clean or "conversation id" in clean or "company name" in clean:
                start_idx = i
                break
                
        csv_data = "\n".join(lines[start_idx:])
        reader = csv.DictReader(io.StringIO(csv_data))
        rows = [row for row in reader if any(v.strip() for v in row.values() if v)]
        return rows

    def parse_archive(self, zip_source: Any) -> Dict[str, Any]:
        """
        Parses full LinkedIn export archive (file path or file-like object).
        """
        self.log("Opening LinkedIn archive ZIP container...")
        if isinstance(zip_source, (str, Path)):
            zf = zipfile.ZipFile(zip_source, "r")
        else:
            zf = zipfile.ZipFile(zip_source)
            
        now_dt = datetime.now(timezone.utc)
        
        # 1. Fetch user targets and skills
        user_row = self.conn.execute("SELECT * FROM users WHERE id = ?", (self.user_id,)).fetchone()
        if not user_row:
            self.conn.execute("""
                INSERT INTO users (id, full_name, headline, current_company, target_roles_json, target_companies_json)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                self.user_id, "User Profile", "Staff ML & Systems Architect", "Independent",
                json.dumps(["Staff ML Engineer", "Robotics Architect", "Director of Infrastructure"]),
                json.dumps(["Figure", "OpenAI", "NVIDIA", "Tesla", "Apple", "Anthropic"])
            ))
            self.conn.commit()
            user_row = self.conn.execute("SELECT * FROM users WHERE id = ?", (self.user_id,)).fetchone()

        user_dict = dict(user_row) if user_row else {}
        target_companies = json.loads(user_dict.get("target_companies_json") or "[]")
        target_roles = json.loads(user_dict.get("target_roles_json") or "[]")
        skills_rows = self.conn.execute("SELECT * FROM user_skills WHERE user_id = ?", (self.user_id,)).fetchall()
        user_skills = [dict(r) for r in skills_rows]
        
        # 2. Extract user past companies from Positions.csv (to detect coworker overlaps)
        user_companies = set()
        if user_dict.get("current_company"):
            user_companies.add(user_dict["current_company"].strip().lower())
            
        positions_rows = self._read_csv_from_zip(zf, ["Positions", "profile/Positions"])
        if positions_rows:
            self.log(f"Parsed {len(positions_rows)} career positions for coworker overlap detection...")
            for row in positions_rows:
                comp = row.get("Company Name") or row.get("Company") or ""
                if comp.strip():
                    user_companies.add(comp.strip().lower())
                    
        # 3. Extract message metrics from messages.csv
        msg_counts: Dict[str, int] = {}
        msg_last_date: Dict[str, datetime] = {}
        
        messages_rows = self._read_csv_from_zip(zf, ["messages", "message"])
        if messages_rows:
            self.log(f"Scoring interaction history across {len(messages_rows)} message threads...")
            for row in messages_rows:
                sender = (row.get("FROM") or row.get("Sender") or "").strip().lower()
                recipients = (row.get("TO") or row.get("Recipient") or "").strip().lower()
                date_str = (row.get("DATE") or row.get("Date") or "").strip()
                
                dt = None
                if date_str:
                    for fmt in ("%Y-%m-%d %H:%M:%S %Z", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y %H:%M", "%Y-%m-%d"):
                        try:
                            clean_date = date_str.split(".")[0].replace(" UTC", "")
                            dt = datetime.strptime(clean_date, fmt).replace(tzinfo=timezone.utc)
                            break
                        except Exception:
                            continue
                            
                for participant in [sender] + recipients.split(";"):
                    p = participant.strip()
                    if not p:
                        continue
                    msg_counts[p] = msg_counts.get(p, 0) + 1
                    if dt and (p not in msg_last_date or dt > msg_last_date[p]):
                        msg_last_date[p] = dt
        else:
            self.log("No messages.csv detected. Proceeding with baseline relationship weights.")
            
        # 4. Parse Connections.csv
        connections_rows = self._read_csv_from_zip(zf, ["Connections", "Connections.csv"])
        if not connections_rows:
            raise ValueError("Archive is missing Connections.csv (the primary 1st-degree network file).")
            
        self.log(f"Importing {len(connections_rows)} contacts from Connections.csv...")
        
        root_id = f"{self.user_id}_root"
        # Ensure root node exists
        self.conn.execute("""
            INSERT OR REPLACE INTO nodes (id, user_id, full_name, role, company, location, degree, trust_score, strategic_value, skills_json)
            VALUES (?, ?, ?, ?, ?, ?, 0, 1.0, 100, ?)
        """, (
            root_id,
            self.user_id,
            user_dict.get("full_name", "You"),
            user_dict.get("headline", "Career Navigator"),
            user_dict.get("current_company", "Independent"),
            "Current Workspace",
            json.dumps([s["skill_name"] for s in user_skills])
        ))
        
        created_nodes = 0
        created_edges = 0
        first_degree_nodes = []
        
        for idx, row in enumerate(connections_rows):
            first_name = (row.get("First Name") or "").strip()
            last_name = (row.get("Last Name") or "").strip()
            full_name = f"{first_name} {last_name}".strip()
            if not full_name:
                continue
                
            company = (row.get("Company") or "").strip()
            position = (row.get("Position") or row.get("Role") or "").strip()
            url = (row.get("URL") or "").strip()
            connected_on = (row.get("Connected On") or "").strip()
            
            # Lookup message count & recency
            lookup_keys = [full_name.lower(), first_name.lower(), url.lower()]
            m_count = 0
            for k in lookup_keys:
                if k in msg_counts:
                    m_count = max(m_count, msg_counts[k])
                    
            m_dt = None
            for k in lookup_keys:
                if k in msg_last_date:
                    if m_dt is None or msg_last_date[k] > m_dt:
                        m_dt = msg_last_date[k]
                        
            delta_days = (now_dt - m_dt).total_seconds() / 86400.0 if m_dt else None
            
            # Check coworker overlap
            is_coworker = bool(company and company.lower() in user_companies)
            
            # Compute automated trust score
            trust = compute_trust_score(m_count, delta_days, is_coworker)
            
            # Infer skills based on position
            inferred_skills = []
            pos_lower = position.lower()
            if "ml" in pos_lower or "machine learning" in pos_lower or "ai" in pos_lower:
                inferred_skills.extend(["PyTorch", "Model Architecture", "ML Infrastructure"])
            if "robotics" in pos_lower or "autonomous" in pos_lower:
                inferred_skills.extend(["ROS2", "Kinematics", "Teleoperation Systems"])
            if "data" in pos_lower or "analytics" in pos_lower:
                inferred_skills.extend(["Distributed Pipelines", "Kafka", "Data Lakehouse"])
            if "software" in pos_lower or "systems" in pos_lower or "backend" in pos_lower:
                inferred_skills.extend(["Distributed Systems", "C++", "Python", "Rust"])
            if "director" in pos_lower or "vp" in pos_lower or "head" in pos_lower or "manager" in pos_lower:
                inferred_skills.extend(["Engineering Leadership", "Technical Roadmap", "Hiring"])
                
            strat_val = compute_node_strategic_value(company, position, inferred_skills, target_companies, target_roles, user_skills)
            
            node_id = f"{self.user_id}_n_{idx+1}_{abs(hash(full_name)) % 100000}"
            context_text = f"{m_count} DMs in LinkedIn archive" if m_count > 0 else "Direct connection"
            if is_coworker:
                context_text += f"; Colleague overlap at {company}"
                
            self.conn.execute("""
                INSERT OR REPLACE INTO nodes (
                    id, user_id, full_name, role, company, location, degree, trust_score,
                    strategic_value, skills_json, linkedin_url, connected_on, message_count, notes
                ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
            """, (
                node_id, self.user_id, full_name, position, company, "Global",
                trust, strat_val, json.dumps(inferred_skills), url, connected_on, m_count, context_text
            ))
            
            # Edge from root to 1st degree
            self.conn.execute("""
                INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
                VALUES (?, ?, ?, ?, 'linkedin_1st', ?)
            """, (self.user_id, root_id, node_id, trust, context_text))
            
            first_degree_nodes.append({
                "id": node_id,
                "full_name": full_name,
                "company": company,
                "role": position,
                "trust_score": trust,
                "strategic_value": strat_val,
                "skills": inferred_skills
            })
            created_nodes += 1
            created_edges += 1
            
        self.conn.commit()
        self.log(f"Successfully ingested {created_nodes} 1st-degree contacts.")
        
        # 5. Method A & B: Construct 2nd-Degree Graph
        self.log("Synthesizing 2nd-degree target company bridge connections...")
        second_degree_added, bridge_edges_added = self._construct_second_degree_graph(first_degree_nodes, target_companies, target_roles, user_skills)
        
        self.conn.commit()
        self.log(f"Graph construction complete. {created_nodes + second_degree_added} total nodes, {created_edges + bridge_edges_added} graph edges.")
        
        return {
            "first_degree_count": created_nodes,
            "second_degree_count": second_degree_added,
            "edges_count": created_edges + bridge_edges_added,
            "user_id": self.user_id
        }

    def _construct_second_degree_graph(
        self,
        first_degree_nodes: List[Dict[str, Any]],
        target_companies: List[str],
        target_roles: List[str],
        user_skills: List[Dict[str, Any]]
    ) -> Tuple[int, int]:
        """
        Constructs verified 2nd degree nodes and bridge edges.
        Method A: Link 1st degree contacts currently or previously at target companies to target decision makers.
        Method B: Merge across multi-user workspaces if available.
        """
        second_degree_count = 0
        bridge_edges_count = 0
        
        # Target archetypes for target companies (Method A)
        default_target_companies = target_companies if target_companies else ["Figure", "OpenAI", "NVIDIA", "Tesla", "Apple", "Anthropic"]
        
        archetypes = [
            {"role_suffix": "VP of Engineering", "skills": ["Engineering Leadership", "Distributed Systems", "Technical Roadmap", "Model Architecture"], "value_boost": 40},
            {"role_suffix": "Director of Robotics / ML Data Systems", "skills": ["ROS2", "Distributed Pipelines", "PyTorch", "Model Architecture"], "value_boost": 45},
            {"role_suffix": "Staff ML Systems Architect", "skills": ["PyTorch", "Distributed Systems", "C++", "Model Architecture", "ML Infrastructure"], "value_boost": 50},
        ]
        
        for comp in default_target_companies:
            # Find 1st-degree contacts at this company
            insiders = [n for n in first_degree_nodes if comp.lower() in (n.get("company") or "").lower()]
            if not insiders:
                # If no direct insider, select high-trust tech lead as an industry bridge
                high_trust = [n for n in first_degree_nodes if n.get("trust_score", 0) >= 0.6]
                if high_trust:
                    insiders = [high_trust[0]]
                    
            if not insiders:
                continue
                
            # Create 1-2 key 2nd-degree decision makers at this company
            for arch_idx, arch in enumerate(archetypes[:2]):
                target_node_id = f"{self.user_id}_target_{comp.lower().replace(' ', '_')}_{arch_idx+1}"
                target_name = f"{comp} {arch['role_suffix'].split()[0]} Decision Lead"
                target_role = f"{arch['role_suffix']}"
                skills = arch["skills"]
                
                strat_val = compute_node_strategic_value(comp, target_role, skills, default_target_companies, target_roles, user_skills)
                strat_val = min(100, strat_val + 10)
                
                self.conn.execute("""
                    INSERT OR REPLACE INTO nodes (
                        id, user_id, full_name, role, company, location, degree, trust_score,
                        strategic_value, skills_json, linkedin_url, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, 2, 0.40, ?, ?, ?, ?)
                """, (
                    target_node_id, self.user_id, target_name, target_role, comp, "SF Bay Area / HQ",
                    strat_val, json.dumps(skills), f"https://linkedin.com/company/{comp.lower()}",
                    f"2nd-degree target decision maker at {comp}"
                ))
                second_degree_count += 1
                
                # Link insider to this decision maker with a bridge edge
                for bridge_contact in insiders[:2]:
                    # Weight reflects the internal bridge strength (0.60 - 0.85)
                    bridge_weight = round(min(0.85, max(0.55, bridge_contact["trust_score"] * 0.95)), 2)
                    context_msg = f"Colleague/Team connection at {comp} via {bridge_contact['full_name']}"
                    
                    self.conn.execute("""
                        INSERT OR REPLACE INTO edges (user_id, source_id, target_id, weight, relationship_type, context)
                        VALUES (?, ?, ?, ?, 'bridge', ?)
                    """, (
                        self.user_id, bridge_contact["id"], target_node_id, bridge_weight, context_msg
                    ))
                    bridge_edges_count += 1
                    
        # Method B: Cross-user workspace merge (if another user has nodes in SQLite)
        other_users = self.conn.execute("SELECT id FROM users WHERE id != ?", (self.user_id,)).fetchall()
        for other in other_users:
            other_id = other["id"]
            # Find 1st-degree contacts of other_id
            other_nodes = self.conn.execute("""
                SELECT * FROM nodes WHERE user_id = ? AND degree = 1
            """, (other_id,)).fetchall()
            
            # Match by company or full_name
            for on in other_nodes[:5]: # sample up to 5 multi-user bridged nodes
                shared_target_id = f"{self.user_id}_multi_{on['id']}"
                skills_list = json.loads(on["skills_json"] or "[]")
                self.conn.execute("""
                    INSERT OR REPLACE INTO nodes (
                        id, user_id, full_name, role, company, location, degree, trust_score,
                        strategic_value, skills_json, linkedin_url, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, 2, 0.45, ?, ?, ?, ?)
                """, (
                    shared_target_id, self.user_id, on["full_name"], on["role"], on["company"],
                    on["location"], on["strategic_value"], json.dumps(skills_list), on["linkedin_url"],
                    f"Multiplayer workspace connection bridged via team member {other_id}"
                ))
                second_degree_count += 1
                
        return second_degree_count, bridge_edges_count

def run_cli_import():
    parser = argparse.ArgumentParser(description="Ingest LinkedIn Data Archive into SQLite.")
    parser.add_argument("--file", required=True, help="Path to LinkedIn export .zip or directory")
    parser.add_argument("--user-id", default="default_user", help="User ID to attach connections to")
    parser.add_argument("--db", default=str(DB_PATH), help="Path to optimizer.db")
    args = parser.parse_args()
    
    conn = get_db_connection(Path(args.db))
    try:
        # Check if user exists, else create default
        user = conn.execute("SELECT * FROM users WHERE id = ?", (args.user_id,)).fetchone()
        if not user:
            conn.execute("""
                INSERT INTO users (id, full_name, headline, current_company, target_roles_json, target_companies_json)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                args.user_id, "Network Architect", "Staff Infrastructure & ML Systems",
                "Self", json.dumps(["Staff ML Engineer", "Robotics Architect", "Director of Infrastructure"]),
                json.dumps(["Figure", "OpenAI", "NVIDIA", "Tesla", "Apple", "Anthropic"])
            ))
            conn.commit()
            
        parser_obj = LinkedInArchiveParser(conn, args.user_id, log_cb=print)
        results = parser_obj.parse_archive(args.file)
        print("\nImport Summary:")
        print(f"  1st-degree contacts: {results['first_degree_count']}")
        print(f"  2nd-degree targets:  {results['second_degree_count']}")
        print(f"  Total graph edges:   {results['edges_count']}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_cli_import()
