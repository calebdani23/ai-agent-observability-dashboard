# Deployment Guide

## Frontend: GitHub Pages

1. Push the repository to GitHub.
2. In **Settings > Pages**, choose **GitHub Actions**.
3. Optionally create repository variables: `VITE_API_URL`, `VITE_REPO_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. The Supabase values are public Auth configuration, not provider secrets. If `VITE_API_URL` is unset, production builds target `https://ai-agent-observability-api.onrender.com`; local Vite dev still defaults to `http://localhost:8000`. Leave `VITE_DEMO_MODE` unset for live-only production, or set `VITE_DEMO_MODE=true` only when you intentionally want demo fallback in production.
4. Run `.github/workflows/deploy-pages.yml` or push to `main`.

The workflow runs `npm ci`, `npm run build` and uploads `apps/web/dist`. Production Vite base is `/ai-agent-observability-dashboard/`.

## Backend: Render

Use the repository `render.yaml` blueprint for the fastest setup:

1. In Render, choose **New > Blueprint** and connect this repository.
2. Confirm the free web service from `render.yaml`.
3. Set `DATABASE_URL` when prompted using a Neon/Supabase Postgres connection string.
4. Set `OBSERVABILITY_INGEST_API_KEY` to a long random value for protected trace/demo writes.
5. Set `SUPABASE_PROJECT_URL` and `SUPABASE_PUBLISHABLE_KEY` so FastAPI can validate Supabase access tokens using Supabase Auth.
6. Set `PROVIDER_KEY_ENCRYPTION_KEYS` to a Fernet key generated with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Multiple comma-separated keys support rotation; the first encrypts new keys.
7. Optionally keep legacy `OPENAI_SESSION_ENCRYPTION_KEY`, `OPENAI_SESSION_HASH_SECRET`, and `OPENAI_SESSION_TTL_MINUTES` only while migrating old temporary-cookie sessions.
8. Set `CORS_ORIGINS` when prompted, for example:
   `http://localhost:5173,https://YOUR_GITHUB_USERNAME.github.io,https://YOUR_GITHUB_USERNAME.github.io/ai-agent-observability-dashboard`.
9. Deploy, then open `/health` on the Render service URL.

The blueprint creates:

- Web service: `ai-agent-observability-api`
- Build command: `pip install -r apps/api/requirements.txt`
- Start command: `uvicorn main:app --app-dir apps/api --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

Manual Render setup is also supported with the same Python service settings and environment variables: `DATABASE_URL`, `CORS_ORIGINS`, `ENVIRONMENT=production`, `DEMO_MODE=true`, `OBSERVABILITY_INGEST_API_KEY`, `SUPABASE_PROJECT_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `PROVIDER_KEY_ENCRYPTION_KEYS`.

## Authenticated BYOK OpenAI runs

The `#/openai-run` page requires Supabase sign-in. The static frontend never stores the OpenAI key in `localStorage`, `sessionStorage`, readable cookies, `VITE_*` variables, or source code. The backend encrypts the key in Postgres in `provider_keys`, associates it with the Supabase user id, and returns only a key hint.

For GitHub Pages → Render, authenticated API calls use Supabase bearer tokens. Do not use `*` for CORS origins with auth-sensitive routes. Mutating `/api/openai/*` and `/api/provider-keys/*` routes validate `Origin` and require JSON POST bodies as lightweight CSRF protection.

Privacy model: prompts and model responses from authenticated OpenAI runs are stored as private traces with `ai_traces.user_id = <Supabase user id>`. Signed-out visitors can only read demo traces. Existing legacy real traces are excluded from public defaults and owner-scoped when authenticated.

Write scripts must send the ingest key when it is configured:

```bash
OBSERVABILITY_API_URL=https://YOUR-API.onrender.com \
OBSERVABILITY_INGEST_API_KEY=your-render-ingest-key \
npm run demo:agent
```

For real OpenAI telemetry, run from a server/CLI environment only:

```bash
OPENAI_API_KEY=replace-with-your-openai-api-key \
OBSERVABILITY_API_URL=https://YOUR-API.onrender.com \
OBSERVABILITY_INGEST_API_KEY=your-render-ingest-key \
npm run openai:agent
```

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
- Frontend shows live-only API error: verify `VITE_API_URL` or the default Render API URL, backend health, and backend CORS.
- Frontend shows demo fallback in production: remove `VITE_DEMO_MODE=true` unless demo masking is intentional.
- Backend fails startup: verify `DATABASE_URL` is Postgres and dependencies installed from `apps/api/requirements.txt`.
- Empty dashboard: seed demo data with `POST /api/demo/reset?count=24` or run the demo agent.
- `401 Valid ingest API key required`: set `OBSERVABILITY_INGEST_API_KEY` in the write script to match the backend value, or omit the backend key only for local unprotected development.
- `401 Sign in to access private observability data`: configure Supabase Auth in the frontend (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) and backend (`SUPABASE_PROJECT_URL`, `SUPABASE_PUBLISHABLE_KEY`), then sign in again.
- `Provider key encryption is not configured`: set valid `PROVIDER_KEY_ENCRYPTION_KEYS` on the backend, then redeploy.
- OpenAI auth/quota/rate-limit errors: reconnect with a valid key or check OpenAI billing/limits; an error trace is created when the run reached the provider path.
