.PHONY: setup dev seed import-linkedin docker docker-down clean

# 1. One-command environment & SQLite bootstrap
setup:
	@echo "==> Initializing SQLite database & Python virtual environment..."
	@mkdir -p data/imports
	cd backend && python3 -m venv .venv || python -m venv .venv
	cd backend && (source .venv/bin/activate 2>/dev/null || .venv\Scripts\activate.bat 2>/dev/null || true) && pip install -r requirements.txt
	cd backend && python3 -m app.seed || python -m app.seed
	cd frontend && npm install
	@echo "==> Setup complete! Run 'make dev' to start."

# 2. Launch Backend (Port 8000) + Frontend (Port 5173) concurrently
dev:
	@echo "==> Launching Career Network Optimizer (Backend :8000, Frontend :5173)..."
	@trap 'kill 0' SIGINT 2>/dev/null || true; \
	(cd backend && uvicorn app.main:app --reload --port 8000) & \
	(cd frontend && npm run dev) & \
	wait

# 3. Seed the SQLite database with rich demo network
seed:
	@echo "==> Seeding database with high-fidelity network topology..."
	cd backend && python3 -m app.seed || python -m app.seed

# 4. Ingest a local LinkedIn Archive ZIP from CLI
import-linkedin:
	@echo "==> Ingesting LinkedIn archive..."
	cd backend && python3 -m app.ingest.linkedin_zip --file ../data/imports/sample_linkedin_archive.zip || python -m app.ingest.linkedin_zip --file ../data/imports/sample_linkedin_archive.zip

# 5. Dockerized deployment
docker:
	docker-compose up --build

docker-down:
	docker-compose down

clean:
	rm -rf backend/.venv frontend/node_modules frontend/dist
