# Architecture

## Components

- **Frontend (`apps/web`)**: Vite + React + TypeScript static app with React Router, TanStack Query and Recharts. It reads only `VITE_*` values and can run on GitHub Pages.
- **Backend (`apps/api`)**: FastAPI service with SQLAlchemy models for traces, steps and tool calls. It exposes health, trace CRUD, metrics and demo seed endpoints.
- **Database**: PostgreSQL compatible with local Docker, Neon and Supabase. Production deployment should not depend on local filesystem persistence.
- **Telemetry SDK (`packages/telemetry-sdk`)**: TypeScript helper that builds traces in memory, serializes camelCase inputs to backend snake_case payloads and posts to `/api/traces`.
- **Demo agent (`examples/demo-agent`)**: Executable synthetic workload for travel, code review and support agents.

## Runtime flow

```text
Browser route -> TanStack Query -> API client -> FastAPI -> Postgres
                         | fetch fails and VITE_DEMO_MODE=true
                         v
                  deterministic local demo fixtures

Demo agent -> ObservabilityClient -> POST /api/traces -> metrics/traces update
```

The frontend always prefers live backend data. If the backend is unreachable and demo mode is enabled, pages render deterministic fallback data with a visible banner. If demo mode is disabled, the UI shows an error state.

## Deployment flow

```text
GitHub Actions -> npm ci -> npm run build -> apps/web/dist -> GitHub Pages
Render/Koyeb -> apps/api -> uvicorn main:app --host 0.0.0.0 --port $PORT -> Neon/Supabase Postgres
```

## Key decisions

- Frontend and backend remain separate so no backend secrets are exposed to the static site.
- Cost values are estimated/demo calculations and not billing-grade.
- The SDK sends completed traces as one payload to match the MVP backend API.
- Demo fallback is explicit to avoid hiding live API outages.
