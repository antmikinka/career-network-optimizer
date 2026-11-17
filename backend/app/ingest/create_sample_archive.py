import io
import os
import zipfile
import csv
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
IMPORTS_DIR = DATA_DIR / "imports"
IMPORTS_DIR.mkdir(parents=True, exist_ok=True)
ZIP_FILE = IMPORTS_DIR / "sample_linkedin_archive.zip"

def create_sample_zip():
    # 1. Connections.csv
    connections_data = [
        ["Notes: This is an export of your LinkedIn connection list.", ""],
        ["First Name", "Last Name", "URL", "Email Address", "Company", "Position", "Connected On"],
        ["Sarah", "Chen", "https://www.linkedin.com/in/sarah-chen", "sarah@figure.ai", "Figure", "Principal Robotics Engineer", "12 Jan 2021"],
        ["Marcus", "Vance", "https://www.linkedin.com/in/marcus-vance", "marcus@openai.com", "OpenAI", "Director of Distributed Training", "05 Mar 2020"],
        ["Elena", "Rostova", "https://www.linkedin.com/in/elena-rostova", "erostova@nvidia.com", "NVIDIA", "Senior Staff Systems Architect", "18 Aug 2021"],
        ["David", "Kim", "https://www.linkedin.com/in/david-kim", "dkim@apple.com", "Apple", "Lead Platform Engineer", "14 Feb 2022"],
        ["Rachel", "Patel", "https://www.linkedin.com/in/rachel-patel", "rpatel@anthropic.com", "Anthropic", "Head of AI Data Infrastructure", "09 Nov 2022"],
        ["Jason", "Brody", "https://www.linkedin.com/in/jason-brody", "jbrody@tesla.com", "Tesla", "Staff Integration Architect", "01 Jun 2019"],
        ["Priya", "Sharma", "https://www.linkedin.com/in/priya-sharma", "psharma@figure.ai", "Figure", "Senior ML Infrastructure Engineer", "20 May 2023"],
        ["Kevin", "Zhang", "https://www.linkedin.com/in/kevin-zhang", "kzhang@openai.com", "OpenAI", "Principal Research Scientist", "11 Oct 2022"],
        ["Maya", "Lin", "https://www.linkedin.com/in/maya-lin", "mlin@nvidia.com", "NVIDIA", "Senior ML Systems Engineer", "17 Jul 2023"],
        ["Carlos", "Mendez", "https://www.linkedin.com/in/carlos-mendez", "cmendez@figure.ai", "Figure", "Staff Robotics Controls Engineer", "02 Apr 2023"],
        ["Chloe", "Bennett", "https://www.linkedin.com/in/chloe-bennett", "cbennett@anthropic.com", "Anthropic", "Engineering Manager, Foundation Models", "29 Aug 2022"],
        ["Derek", "Wu", "https://www.linkedin.com/in/derek-wu", "dwu@apple.com", "Apple", "Staff Systems Performance Lead", "15 Jan 2024"],
        ["Sophie", "Larson", "https://www.linkedin.com/in/sophie-larson", "slarson@google.com", "Google DeepMind", "Staff Research Scientist", "10 Oct 2023"],
        ["Hassan", "Malik", "https://www.linkedin.com/in/hassan-malik", "hmalik@meta.com", "Meta", "Production Engineering Director", "04 Dec 2021"],
        ["Emily", "Zhao", "https://www.linkedin.com/in/emily-zhao", "ezhao@figure.ai", "Figure", "Senior Teleoperation Engineer", "19 Jan 2024"]
    ]

    # 2. messages.csv
    messages_data = [
        ["CONVERSATION ID", "CONVERSATION TITLE", "FROM", "SENDER PROFILE URL", "TO", "RECIPIENT PROFILE URLS", "DATE", "SUBJECT", "CONTENT"],
        ["c1", "Collaboration", "Jason Brody", "https://www.linkedin.com/in/jason-brody", "Alex Mercer", "https://www.linkedin.com/in/alex-mercer", "2026-10-15 14:22:00 UTC", "Optimus sync", "Let's review the fleet telemetry bandwidth numbers"],
        ["c1", "Collaboration", "Alex Mercer", "https://www.linkedin.com/in/alex-mercer", "Jason Brody", "https://www.linkedin.com/in/jason-brody", "2026-10-15 14:35:00 UTC", "Re: Optimus sync", "Sent over the telemetry schema."],
        ["c2", "Figure Catchup", "Sarah Chen", "https://www.linkedin.com/in/sarah-chen", "Alex Mercer", "https://www.linkedin.com/in/alex-mercer", "2026-11-01 19:10:00 UTC", "Figure 02 updates", "Jonathan and I were discussing the data platform architecture."],
        ["c3", "OpenAI Supercomputing", "Marcus Vance", "https://www.linkedin.com/in/marcus-vance", "Alex Mercer", "https://www.linkedin.com/in/alex-mercer", "2026-11-08 09:40:00 UTC", "Distributed training benchmarks", "The split graph onnx runtime showed 3.2x throughput increase."],
        ["c4", "Apple Silicon", "David Kim", "https://www.linkedin.com/in/david-kim", "Alex Mercer", "https://www.linkedin.com/in/alex-mercer", "2026-10-20 11:15:00 UTC", "MLX graph runtime", "Would love your take on our latest runtime layer."],
        ["c5", "NVIDIA GTC", "Elena Rostova", "https://www.linkedin.com/in/elena-rostova", "Alex Mercer", "https://www.linkedin.com/in/alex-mercer", "2026-09-12 16:50:00 UTC", "Robotics panel", "Catch you at GTC in San Jose!"]
    ]

    # 3. Positions.csv
    positions_data = [
        ["Company Name", "Title", "Description", "Location", "Started On", "Finished On"],
        ["Tesla", "Senior Infrastructure Engineer", "Optimus & Autopilot fleet systems", "Palo Alto, CA", "Jan 2021", "Aug 2023"],
        ["Autonomous Systems", "Staff Systems & ML Architect", "Robotics data operations & platform runtime", "San Francisco, CA", "Sep 2023", "Present"]
    ]

    with zipfile.ZipFile(ZIP_FILE, "w", zipfile.ZIP_DEFLATED) as zf:
        # Write Connections.csv
        conn_buf = io.StringIO()
        writer = csv.writer(conn_buf)
        writer.writerows(connections_data)
        zf.writestr("Connections.csv", conn_buf.getvalue())

        # Write messages.csv
        msg_buf = io.StringIO()
        writer = csv.writer(msg_buf)
        writer.writerows(messages_data)
        zf.writestr("messages.csv", msg_buf.getvalue())

        # Write Positions.csv
        pos_buf = io.StringIO()
        writer = csv.writer(pos_buf)
        writer.writerows(positions_data)
        zf.writestr("Positions.csv", pos_buf.getvalue())

    print(f"Sample LinkedIn archive generated at: {ZIP_FILE}")

if __name__ == "__main__":
    create_sample_zip()
