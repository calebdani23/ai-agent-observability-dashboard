# Deployment Guide

## Frontend: GitHub Pages

1. Push the repository to GitHub.
2. In **Settings > Pages**, choose **GitHub Actions**.
3. Optionally create repository variables: `VITE_API_URL`, `VITE_DEMO_MODE=true`, `VITE_REPO_URL`.
4. Run `.github/workflows/deploy-pages.yml` or push to `main`.

The workflow runs `npm ci`, `npm run build` and uploads `apps/web/dist`. Production Vite base is `/ai-agent-observability-dashboard/`.

## Backend: Render

Use the repository `render.yaml` blueprint for the fastest setup:

1. In Render, choose **New > Blueprint** and connect this repository.
2. Confirm the free web service from `render.yaml`.
3. Set `DATABASE_URL` when prompted using a Neon/Supabase Postgres connection string.
4. Set `CORS_ORIGINS` when prompted, for example:
   `http://localhost:5173,https://YOUR_GITHUB_USERNAME.github.io,https://YOUR_GITHUB_USERNAME.github.io/ai-agent-observability-dashboard`.
5. Deploy, then open `/health` on the Render service URL.

The blueprint creates:

- Web service: `ai-agent-observability-api`
- Build command: `pip install -r apps/api/requirements.txt`
- Start command: `uvicorn main:app --app-dir apps/api --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

Manual Render setup is also supported with the same Python service settings and environment variables: `DATABASE_URL`, `CORS_ORIGINS`, `ENVIRONMENT=production`, `DEMO_MODE=true`.

## Backend: Koyeb

Use the same Python service settings. Set the working directory to `apps/api`, install `requirements.txt`, and start with `uvicorn main:app --host 0.0.0.0 --port $PORT`.

## Database: Neon or Supabase

Create a free Postgres database and copy the pooled or direct connection string into `DATABASE_URL`. The API creates tables on startup for the MVP. Do not use local filesystem storage for production persistence on free hosts.

## CORS

Set `CORS_ORIGINS` to a comma-separated list, for example:

```bash
CORS_ORIGINS=http://localhost:5173,https://YOUR_GITHUB_USERNAME.github.io,https://YOUR_GITHUB_USERNAME.github.io/ai-agent-observability-dashboard
```

## Troubleshooting

- Blank Pages deploy: confirm Pages source is GitHub Actions and Vite base is `/ai-agent-observability-dashboard/`.
- Frontend shows demo fallback: verify `VITE_API_URL` and backend CORS.
- Backend fails startup: verify `DATABASE_URL` is Postgres and dependencies installed from `apps/api/requirements.txt`.
- Empty dashboard: seed demo data with `POST /api/demo/reset?count=24` or run the demo agent.
