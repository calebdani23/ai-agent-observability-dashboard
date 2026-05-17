# AI Agent Observability Dashboard

Portfolio-grade observability for AI applications and agents: LLM calls, prompts, responses, tool calls, tokens, estimated cost, latency, errors, sessions and full execution traces.

## Why it exists

AI agent behavior is hard to debug when prompts, tool calls, cost and failures are scattered across logs. This project provides a static React dashboard, FastAPI/Postgres backend, local telemetry SDK and executable demo agent so an AI product team can inspect runs end-to-end without putting secrets in the frontend.

## Features

- Landing page, dashboard, trace explorer, trace detail and analytics routes.
- Live API integration with production live-only defaults and explicit local demo fallback when enabled.
- Metric cards and charts for requests, tokens, estimated cost, latency, model usage and errors.
- Trace timeline with prompt inspector, step details, metadata, tool-call input/output and redaction notice.
- Temporary web OpenAI key sessions: users can paste a personal key, the backend stores it encrypted with TTL, runs OpenAI server-side, and records the run as a trace.
- TypeScript telemetry SDK and demo agent for Travel Planning, Code Review and Customer Support scenarios.
- Protected ingest path plus a real OpenAI example that posts traces from a server-side/CLI environment.
- GitHub Pages workflow for the frontend and Render/Koyeb + Neon/Supabase deployment docs for the backend/database.

## Architecture

```text
apps/web                  Vite React static dashboard (secret-free)
apps/api                  FastAPI service, Postgres models, metrics and demo seed endpoints
packages/telemetry-sdk    Local TypeScript SDK for creating traces
packages/shared           Shared telemetry contracts
examples/demo-agent       Synthetic agent runs that post traces to the backend
docs/                     Architecture, telemetry, deployment, roadmap and presentation guide
```

```text
Browser -> VITE_API_URL -> FastAPI -> Postgres
   | API unavailable and VITE_DEMO_MODE=true (local dev default; production opt-in)
   v
deterministic local demo fixtures + visible banner

Production/live-only mode -> API unavailable -> explicit error state, no masked demo data

Demo/OpenAI agent -> telemetry SDK + ingest key -> POST /api/traces -> dashboard/analytics refresh
Browser OpenAI run -> temporary HttpOnly cookie -> backend decrypts key -> OpenAI -> stored trace
```

## Screenshots

Screenshot placeholders and capture instructions live in [`docs/screenshots/README.md`](docs/screenshots/README.md). Recommended captures: landing, dashboard, trace explorer, trace detail prompt inspector and analytics.

## Local development

### Install

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
```

### Frontend

```bash
npm run dev:web
```

Open http://localhost:5173. Production build:

```bash
npm run build
```

### Backend

```bash
DATABASE_URL=postgresql://observability:observability@localhost:5432/observability \
PORT=8000 CORS_ORIGINS=http://localhost:5173 DEMO_MODE=true \
OBSERVABILITY_INGEST_API_KEY=dev-ingest-key \
OPENAI_SESSION_ENCRYPTION_KEY=generate-with-python-cryptography-fernet \
OPENAI_SESSION_HASH_SECRET=replace-with-a-different-long-random-secret \
uvicorn main:app --app-dir apps/api --host 0.0.0.0 --port 8000
```

Health check: `curl http://localhost:8000/health`.

### Docker Compose

```bash
docker compose up --build
```

Services: frontend http://localhost:5173, backend http://localhost:8000, Postgres localhost:5432.

## Demo data

Seed backend-generated traces:

```bash
curl -X POST 'http://localhost:8000/api/demo/reset?count=24'
```

Run the TypeScript demo agent through the SDK:

```bash
OBSERVABILITY_API_URL=http://localhost:8000 DEMO_TRACE_COUNT=9 npm run demo:agent
```

The demo agent creates successful, warning and error traces with realistic steps and tool calls. No provider keys are required.

If `OBSERVABILITY_INGEST_API_KEY` is set on the backend, include the same variable when running write scripts:

```bash
OBSERVABILITY_API_URL=http://localhost:8000 \
OBSERVABILITY_INGEST_API_KEY=dev-ingest-key \
DEMO_TRACE_COUNT=9 npm run demo:agent
```

## Real OpenAI integration

Run a real OpenAI call from a server-side/CLI environment, record LLM/tool steps, and send the trace to the backend:

```bash
OPENAI_API_KEY=replace-with-your-openai-api-key \
OBSERVABILITY_API_URL=http://localhost:8000 \
OBSERVABILITY_INGEST_API_KEY=dev-ingest-key \
npm run openai:agent
```

Optional: `OPENAI_MODEL=gpt-4o-mini` and `OPENAI_AGENT_PROMPT="..."`. Keep `OPENAI_API_KEY` and `OBSERVABILITY_INGEST_API_KEY` out of frontend `VITE_*` variables.

## Environment variables

Frontend variables are safe public `VITE_*` values only:

```bash
VITE_API_URL=http://localhost:8000
# Leave unset for production live-only builds.
# For local development only, set VITE_DEMO_MODE=true to enable demo fallback.
# VITE_DEMO_MODE=true
VITE_REPO_URL=https://github.com/YOUR_USERNAME/ai-agent-observability-dashboard
```

When `VITE_API_URL` is unset, local Vite development defaults to `http://localhost:8000` and production builds default to `https://ai-agent-observability-api.onrender.com`. When `VITE_DEMO_MODE` is unset, local development enables fallback by default, but production is live-only by default. Set `VITE_DEMO_MODE=true` explicitly in production only if you want local demo fixtures to mask API outages.

Backend variables stay server-side:

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
CORS_ORIGINS=http://localhost:5173,https://YOUR_GITHUB_USERNAME.github.io
ENVIRONMENT=development
DEMO_MODE=true
OBSERVABILITY_INGEST_API_KEY=replace-with-a-long-random-ingest-key
OPENAI_SESSION_ENCRYPTION_KEY=generate-with-python-cryptography-fernet
OPENAI_SESSION_HASH_SECRET=replace-with-a-different-long-random-secret
OPENAI_SESSION_TTL_MINUTES=60
PORT=8000
```

Never commit real `.env` files or secrets.

Generate the Fernet encryption key with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.

The `#/openai-run` page sends a browser-entered OpenAI key to the backend only, stores it encrypted in Postgres behind an opaque `HttpOnly` cookie, and clears it on disconnect or TTL expiry. The frontend remains secret-free. Prompts and model responses from this MVP are stored as regular traces visible through the current public dashboard/API, so do not submit sensitive prompts or secrets.

## API summary

- `GET /health`
- `POST /api/traces` (ingest key if configured), `GET /api/traces`, `GET /api/traces/{trace_id}`, `DELETE /api/traces/{trace_id}` (ingest key if configured)
- Trace and metrics reads support `dataset=current_openai_session|all_real|demo|all`. `current_openai_session` is a convenience filter based on the temporary OpenAI session cookie; it is not account auth or privacy isolation, and missing/expired sessions return empty scoped results.
- `POST /api/openai/sessions`, `GET /api/openai/session`, `DELETE /api/openai/session`, `POST /api/openai/runs` for temporary encrypted server-side OpenAI key sessions
- `GET /api/metrics/overview`, `/api/metrics/timeseries`, `/api/metrics/models`, `/api/metrics/tools`, `/api/metrics/errors`
- `POST /api/demo/generate-traces?count=24`, `POST /api/demo/reset?count=24` (ingest key if configured)

Costs use demo model pricing and are estimates only, not billing-grade amounts.

## Deployment

- Frontend: GitHub Pages via `.github/workflows/deploy-pages.yml`; Vite production base is `/ai-agent-observability-dashboard/` and routes use hash URLs so direct links work on static hosting.
- Backend: Render Blueprint via `render.yaml`, or a Koyeb/Python web service using `uvicorn main:app --app-dir apps/api --host 0.0.0.0 --port $PORT`.
- Database: Neon or Supabase Postgres via `DATABASE_URL`; do not rely on ephemeral filesystem storage.

See [`docs/deployment.md`](docs/deployment.md) for complete steps, CORS guidance and troubleshooting.

## SDK usage

```ts
import { ObservabilityClient } from "@portfolio/telemetry-sdk";

const client = new ObservabilityClient({
  apiUrl: process.env.OBSERVABILITY_API_URL!,
  apiKey: process.env.OBSERVABILITY_INGEST_API_KEY,
  appName: "demo-code-review-agent",
});
const trace = client.createTrace({ sessionId: "session_123", operation: "issue_triage", model: "gpt-4.1-mini" });
client.addStep(trace.id, { stepType: "llm_call", name: "analyze_repository", inputTokens: 1200, outputTokens: 300 });
client.finishTrace(trace.id, { status: "success" });
await client.sendTrace(trace.id);
```

## Docs

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/telemetry-spec.md`](docs/telemetry-spec.md)
- [`docs/deployment.md`](docs/deployment.md)
- [`docs/demo-script.md`](docs/demo-script.md)
- [`docs/roadmap.md`](docs/roadmap.md)

## Roadmap

Completed MVP: static dashboard, FastAPI/Postgres traces and metrics, demo fallback, SDK, demo agent and deployment documentation. Future improvements: auth/team scopes, migrations, alerts, real provider integrations, sampling controls and hosted SDK packaging.

## Engineering decisions

- Keep frontend static, public and secret-free.
- Keep backend env-driven and compatible with free hosts.
- Prefer Postgres for persistence and avoid filesystem storage in production.
- Keep production live-only by default; show an explicit error if the API is unavailable, and show demo fallback explicitly only when enabled.
- Label all cost values as estimated/demo calculations.
