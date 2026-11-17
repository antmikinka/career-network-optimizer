import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from starlette.testclient import TestClient
from app.main import app
from app.seed import seed_database
from app.db import get_db_connection

def test_full_pipeline():
    print("==> Seeding database for test verification...")
    seed_database(include_demo_contacts=True)

    client = TestClient(app)

    # 1. Test Health Check
    print("==> Testing /api/health...")
    res = client.get("/api/health")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "healthy"
    print(f"    Health OK: {data['total_nodes']} nodes in database.")

    # 2. Test User Profile
    print("==> Testing /api/users/default_user...")
    res = client.get("/api/users/default_user")
    assert res.status_code == 200, res.text
    user = res.json()
    assert "target_companies" in user
    assert "Figure" in user["target_companies"]
    assert user["full_name"] == "Anthony Mikinka"
    print(f"    Profile OK: {user['full_name']} ({user['headline']})")

    # 3. Test Graph & Dijkstra Paths
    print("==> Testing /api/graph/default_user...")
    res = client.get("/api/graph/default_user")
    assert res.status_code == 200, res.text
    graph = res.json()
    assert len(graph["nodes"]) > 0
    assert len(graph["edges"]) > 0
    assert len(graph["calculated_paths"]) > 0
    print(f"    Graph OK: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges, {len(graph['calculated_paths'])} Dijkstra paths.")
    top_path = graph["calculated_paths"][0]
    print(f"    Top Path: To {top_path['target_name']} via {top_path['bridge_name']} (P = {top_path['conversion_prob']}%)")

    # 4. Test Outreach Blurbs Generation
    print("==> Testing /api/outreach/default_user/t_figure_vp...")
    res = client.get("/api/outreach/default_user/t_figure_vp")
    assert res.status_code == 200, res.text
    outreach = res.json()
    assert "bridge_intro_request" in outreach["outreach"]
    assert "forwardable_blurb" in outreach["outreach"]
    assert outreach["bridge_name"] in ["Jason Brody", "Sarah Chen"]
    print(f"    Outreach OK: Intro request and forwardable blurb generated via {outreach['bridge_name']}.")

    # 5. Test Node Patching (Trust Slider)
    print("==> Testing PATCH /api/nodes/n_sarah_chen...")
    res = client.patch("/api/nodes/n_sarah_chen", json={"trust_score": 0.95})
    assert res.status_code == 200, res.text
    print("    Patch OK: Trust score updated to 0.95.")

    # 6. Test Archive Ingestion
    sample_zip = Path(__file__).resolve().parent.parent / "data" / "imports" / "sample_linkedin_archive.zip"
    if sample_zip.exists():
        print(f"==> Testing POST /api/ingest/linkedin with {sample_zip.name}...")
        with open(sample_zip, "rb") as f:
            res = client.post("/api/ingest/linkedin", files={"file": ("sample.zip", f, "application/zip")}, data={"user_id": "test_ingest_user"})
        assert res.status_code == 200, res.text
        ingest_res = res.json()
        print(f"    Ingestion OK: {ingest_res['results']['first_degree_count']} 1st-deg contacts, {ingest_res['results']['second_degree_count']} 2nd-deg bridges.")

    # 7. Test Modular Recalculation Engine
    print("==> Testing /api/process/modules...")
    res = client.get("/api/process/modules")
    assert res.status_code == 200, res.text
    modules_data = res.json()
    assert len(modules_data["modules"]) >= 6
    print(f"    Recalculation Modules OK: {len(modules_data['modules'])} registered processors.")

    print("==> Testing POST /api/process/pipeline...")
    res = client.post("/api/process/pipeline", json={"user_id": "default_user"})
    assert res.status_code == 200, res.text
    pipeline_res = res.json()
    assert pipeline_res["status"] == "success"
    assert len(pipeline_res["pipeline"]["pipeline_processors_executed"]) >= 5
    print(f"    Pipeline OK: Executed {pipeline_res['pipeline']['pipeline_processors_executed']} in {pipeline_res['pipeline']['total_execution_time_ms']}ms.")

    print("\n[ALL TESTS PASSED SUCCESSFULLY!]")

if __name__ == "__main__":
    test_full_pipeline()
