# Demo Presentation Script

1. **Landing page**: explain the problem—AI agent runs are difficult to debug when prompts, tools, costs and errors live in separate logs.
2. **Dashboard**: show total requests, tokens, estimated cost, latency, errors and charts. Call out live API vs demo fallback banner.
3. **Trace explorer**: filter by app/model/status and open a trace.
4. **Trace detail**: walk through the timeline, prompt inspector, redaction notice and tool-call payloads.
5. **Analytics**: show cost by model, tokens by app, slowest operations, expensive traces, errors and tool frequency.
6. **SDK/demo agent**: run `OBSERVABILITY_API_URL=http://localhost:8000 DEMO_TRACE_COUNT=9 npm run demo:agent`, refresh traces and show newly created runs.
7. **Architecture**: summarize static frontend, FastAPI backend, Postgres, SDK and free-host deployment.

Talking point: estimated cost is intentionally labeled as demo/estimated and no provider keys or real user data are required.
