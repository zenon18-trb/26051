# SIH26051 — Shelter Thermal Designer

First-order shelter thermal design prototype (planning docs in the repo
root and `docs/`). This README covers **how to run** the current code.

Python 3.13 and Node.js 20+ were used for Phase 0.

## Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

Tests:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest
```

Optional: copy `backend/.env.example` to `backend/.env` and set
`CORS_ORIGINS`. Phase 0 already defaults to local Next.js origins.

## Frontend (Next.js)

```powershell
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The page calls
`GET {NEXT_PUBLIC_API_BASE_URL}/api/health`.

```powershell
cd frontend
npm run lint
npm run build
```

## Architecture (Phase 0)

Browser → Next.js UI → `fetch` GET → FastAPI `/api/health` → JSON → status card.

Thermal simulation, Open-Meteo, and PDF reporting are not in this phase.
