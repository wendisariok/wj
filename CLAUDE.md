# InboxForge

Gmail search and archival tool. Search Gmail by keywords + date range, store email bodies in SQLite, browse via web UI.

## Tech Stack
- Backend: Python + FastAPI (port 8000)
- Frontend: React + Vite + TypeScript + Tailwind CSS (port 5173)
- Database: SQLite (`C:\AI\InboxForge\inboxforge.db`)
- Gmail: Google API Python client + OAuth2 (gmail.readonly scope)

## Running

### Backend
```bash
cd C:\AI\InboxForge\backend
venv\Scripts\activate
python -m app.main
```

### Frontend
```bash
cd C:\AI\InboxForge\frontend
npm run dev
```

## Google Cloud Setup
1. Create GCP project, enable Gmail API
2. Configure OAuth consent screen (external, test user = your email)
3. Create OAuth 2.0 Web Client credentials
4. Set redirect URI to `http://localhost:8000/api/auth/callback`
5. Copy Client ID + Secret into `backend/.env`

## Built by TheForge, LLC
Vibe coded with Claude
