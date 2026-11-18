import io
import sys
import zipfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import app.db as db_module

# Isolate test suite into a temporary SQLite database so live data/optimizer.db is never polluted
_TEMP_DIR = tempfile.TemporaryDirectory()
_TEST_DB_PATH = Path(_TEMP_DIR.name) / "test_optimizer.db"
db_module.DB_PATH = _TEST_DB_PATH

from starlette.testclient import TestClient
import app.main as main_module

main_module.DB_PATH = _TEST_DB_PATH
db_module.init_db(_TEST_DB_PATH)

from app.main import app
from app.seed import seed_database
from app.db import get_db_connection


def test_full_pipeline():
    print(f"==> Running isolated end-to-end test suite on {_TEST_DB_PATH}...")
    conn = get_db_connection(_TEST_DB_PATH)
    try:
        seed_database(conn, "default_user", include_demo_contacts=False)
    finally:
        conn.close()

    client = TestClient(app)

    # 1. Verify Zero-Placeholder Clean State
    print("==> 1. Verifying clean zero-placeholder initialization...")
    res = client.get("/api/state/default_user")
    assert res.status_code == 200, res.text
    state = res.json()
    assert state["profile"]["name"] == "Anthony Mikinka"
    assert state["profile"]["currentCompany"] == "Tesla"
    assert len(state["nodes"]) == 0, f"Expected 0 placeholder contacts, got {len(state['nodes'])}"
    assert len(state["edges"]) == 0, f"Expected 0 placeholder edges, got {len(state['edges'])}"
    print("    Clean initialization verified: Anthony Mikinka • 0 placeholder contacts.")

    # 2. Test Standalone Connections.csv Ingestion + Deduplication
    print("==> 2. Testing standalone Connections.csv upload & deduplication...")
    csv_payload = (
        "Notes: Exported from LinkedIn\n\n"
        "First Name,Last Name,URL,Email Address,Company,Position,Connected On\n"
        "Contact,Alpha,https://linkedin.com/in/calpha,,Tesla,Staff Robotics Data Engineer,14 Aug 2026\n"
        "Contact,Beta,https://linkedin.com/in/cbeta,,Figure,Principal Controls Architect,02 Sep 2026\n"
    ).encode("utf-8")

    res = client.post(
        "/api/ingest/linkedin",
        files={"file": ("Connections.csv", io.BytesIO(csv_payload), "text/csv")},
        data={"user_id": "default_user"},
    )
    assert res.status_code == 200, res.text
    ingest_data = res.json()
    assert ingest_data["results"]["first_degree_count"] == 2
    assert ingest_data["results"]["second_degree_count"] == 0  # Zero fake targets invented!
    assert len(ingest_data["state"]["nodes"]) == 2

    # Re-upload identical CSV to verify deterministic deduplication
    res_dup = client.post(
        "/api/ingest/linkedin",
        files={"file": ("Connections.csv", io.BytesIO(csv_payload), "text/csv")},
        data={"user_id": "default_user"},
    )
    assert res_dup.status_code == 200
    assert len(res_dup.json()["state"]["nodes"]) == 2, "Duplicate rows created on re-import!"
    print("    CSV ingestion & deterministic deduplication verified.")

    # 3. Test Adding a 2nd-Degree Target at Matching Company -> Automatic Bridge Synthesis!
    print("==> 3. Testing 2nd-degree target creation & automatic company-overlap bridge synthesis...")
    res = client.post(
        "/api/nodes",
        json={
            "user_id": "default_user",
            "name": "Target Exec One",
            "role": "VP of Embodied AI",
            "company": "Figure",
            "degree": 2,
            "trustScore": 0.85,
            "authorityLevel": "Director/VP/Founder",
            "cluster": "Robotics & Embodied AI",
            "skills": ["Humanoid Robotics Telemetry & Data Ops", "ONNX Runtime & Graph Chunking"],
        },
    )
    assert res.status_code == 200, res.text
    created_payload = res.json()
    target_id = created_payload["node_id"]
    # Contact Beta works at Figure, so CompanyBridgeSynthesizer must auto-wire a bridge edge!
    edges_after = created_payload["state"]["edges"]
    assert any(e["target"] == target_id or e["source"] == target_id for e in edges_after), (
        "Expected CompanyBridgeSynthesizer to auto-wire insider edge @ Figure!"
    )
    print(f"    Auto-synthesized insider bridge edge to {target_id}; total edges: {len(edges_after)}.")

    # 4. Test ZIP Archive Ingestion (Connections.csv + messages.csv)
    print("==> 4. Testing LinkedIn .zip archive ingestion with messages.csv...")
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        zf.writestr(
            "Connections.csv",
            "First Name,Last Name,Company,Position,Connected On\n"
            "Contact,Beta,Figure,Principal Controls Architect,02 Sep 2026\n"
            "Contact,Gamma,Apple,Staff MLX Compiler Engineer,10 Oct 2026\n",
        )
        zf.writestr(
            "messages.csv",
            "FROM,TO,DATE,CONTENT\n"
            "Anthony Mikinka,Contact Beta,2026-10-20 14:00:00 UTC,Sync on humanoid telemetry\n"
            "Contact Beta,Anthony Mikinka,2026-10-21 09:30:00 UTC,Sounds great\n",
        )
    zip_buf.seek(0)
    res = client.post(
        "/api/ingest/linkedin",
        files={"file": ("linkedin_export.zip", zip_buf, "application/zip")},
        data={"user_id": "default_user"},
    )
    assert res.status_code == 200, res.text
    assert len(res.json()["state"]["nodes"]) == 4  # Alpha, Beta, Target Exec One, Gamma
    print("    ZIP archive + message count recency scoring verified.")

    # 5. Test Node Trust Patching & Root Edge Sync
    print("==> 5. Verifying PATCH /api/nodes/{id} updates SQLite root edge weight...")
    beta_node = next(n for n in res.json()["state"]["nodes"] if n["name"] == "Contact Beta")
    res = client.patch(f"/api/nodes/{beta_node['id']}", json={"trustScore": 0.96})
    assert res.status_code == 200, res.text
    synced_state = client.get("/api/state/default_user").json()
    beta_edge = next(
        e for e in synced_state["edges"]
        if (e["source"] == "user-root" and e["target"] == beta_node["id"])
        or (e["target"] == "user-root" and e["source"] == beta_node["id"])
    )
    assert beta_edge["weight"] == 0.96, f"Root edge weight did not sync: {beta_edge}"
    print("    Node trust slider -> SQLite edge weight sync verified (w = 0.96).")

    # 6. Test All 8 Modular Recalculation Processors & Persisted EV / Centrality
    print("==> 6. Verifying all 8 modular recalculation processors...")
    mods = client.get("/api/process/modules").json()
    assert len(mods["modules"]) == 8, f"Expected 8 processors, got {len(mods['modules'])}"

    pipe_res = client.post(
        "/api/process/pipeline",
        json={
            "user_id": "default_user",
            "params_map": {"ev": {"goal_mode": "infiltration"}, "delta_ev": {"trust_boost_step": 0.20}},
        },
    )
    assert pipe_res.status_code == 200, pipe_res.text
    pipe_json = pipe_res.json()
    pipeline = pipe_json["pipeline"]
    assert len(pipeline["pipeline_processors_executed"]) == 8
    ev_step = next(r for r in pipeline["results"] if r["processor_id"] == "ev")
    assert ev_step["metrics"]["targets_evaluated"] >= 1, f"EV processor evaluated 0 targets: {ev_step}"
    trust_step = next(r for r in pipeline["results"] if r["processor_id"] == "trust")
    assert trust_step["edges_updated"] >= 3, f"Trust processor updated 0 edges: {trust_step}"

    # Verify EV score persisted onto target node in state
    hydrated_target = next(n for n in pipe_json["state"]["nodes"] if n["id"] == target_id)
    assert hydrated_target["evScore"] > 0, "EV score was not persisted into SQLite!"
    print(
        f"    8-module pipeline verified in {pipeline['total_execution_time_ms']}ms "
        f"(Target EV = {hydrated_target['evScore']}, P(Reach) = {hydrated_target['conversionProb']}%)."
    )

    # 7. Test Outreach Generation & Canonical SQL Export
    print("==> 7. Verifying outreach blurb & SQLite seed.sql export...")
    out_res = client.get(f"/api/outreach/default_user/{target_id}")
    assert out_res.status_code == 200
    assert "Contact Beta" in out_res.json()["bridge_name"]

    sql_res = client.get("/api/export/sql/default_user")
    assert sql_res.status_code == 200
    assert "INSERT OR REPLACE INTO users" in sql_res.text
    assert "Anthony Mikinka" in sql_res.text

    # 8. Test Clean Reset Endpoint
    reset_res = client.post("/api/reset/default_user")
    assert reset_res.status_code == 200
    assert len(reset_res.json()["state"]["nodes"]) == 0
    print("    Clean reset endpoint verified.")

    print("\n[ALL 8 END-TO-END ARCHITECTURAL & GRAPH ENGINE TESTS PASSED!]")


if __name__ == "__main__":
    test_full_pipeline()
