# Demo Presentation Script

1. **Landing page**: explain the problem—AI agent runs are difficult to debug when prompts, tools, costs and errors live in separate logs.
2. **Dashboard**: show total requests, tokens, estimated cost, latency, errors and charts. Call out live API vs demo fallback banner.
3. **Trace explorer**: filter by app/model/status and open a trace.
4. **Trace detail**: walk through the timeline, prompt inspector, redaction notice and tool-call payloads.
5. **Analytics**: show cost by model, tokens by app, slowest operations, expensive traces, errors and tool frequency.
6. **SDK/demo agent**: run `OBSERVABILITY_API_URL=http://localhost:8000 OBSERVABILITY_INGEST_API_KEY=dev-ingest-key DEMO_TRACE_COUNT=9 npm run demo:agent`, refresh traces and show newly created runs.
7. **Real OpenAI path**: from a server/CLI only, run `OPENAI_API_KEY=replace-with-your-openai-api-key OBSERVABILITY_API_URL=http://localhost:8000 OBSERVABILITY_INGEST_API_KEY=dev-ingest-key npm run openai:agent`, then open the real `real-openai-agent` trace.
8. **Architecture**: summarize static frontend, FastAPI backend, protected ingest, Postgres, SDK and free-host deployment.

Talking point: estimated cost is intentionally labeled as demo/estimated; frontend remains secret-free, while provider and ingest keys stay in backend/CLI env vars.
