"""
CLI utility to run modular recalculation pipelines on SQLite database.
Usage:
    python backend/recalculate.py --user default_user --processors trust,centrality,ev
"""
import sys
import os
import argparse
import json

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import get_db_connection, init_db
from app.engine.recalculations import registry

def main():
    parser = argparse.ArgumentParser(description="Nexus Modular Recalculation Engine")
    parser.add_argument("--user", default="default_user", help="User ID to recalculate for")
    parser.add_argument("--processors", default="all", help="Comma-separated processor IDs or 'all'")
    parser.add_argument("--list", action="store_true", help="List all available processors")
    parser.add_argument("--params", default="{}", help="JSON dictionary of parameters per processor")
    args = parser.parse_args()

    if args.list:
        print("\nAvailable Recalculation Processors:")
        for meta in registry.list_metadata():
            print(f"  • [{meta.id}] {meta.name} ({meta.category})")
            print(f"    {meta.description}")
            if meta.parameters_schema:
                print(f"    Params: {list(meta.parameters_schema.keys())}")
        return

    init_db()
    conn = get_db_connection()
    try:
        if args.processors == "all":
            p_list = None
        else:
            p_list = [p.strip() for p in args.processors.split(",") if p.strip()]

        try:
            params_map = json.loads(args.params)
        except Exception:
            params_map = {}

        print(f"\n==> Executing recalculation pipeline for user: '{args.user}'...")
        summary = registry.run_pipeline(conn, args.user, processor_ids=p_list, params_map=params_map)
        print(f"\n[PIPELINE {summary['status'].upper()}] in {summary['total_execution_time_ms']}ms")
        print(f"Processors executed: {', '.join(summary['pipeline_processors_executed'])}")
        print(f"Total nodes updated: {summary['total_nodes_updated']}")
        print(f"Total edges updated: {summary['total_edges_updated']}\n")

        for res in summary["results"]:
            print(f"  ✓ {res['processor_id'].upper()}: {res['message']} ({res['execution_time_ms']}ms)")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
