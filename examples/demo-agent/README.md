# Demo Agent

Executable synthetic agent that sends realistic Travel Planning, Code Review and Customer Support traces to the FastAPI backend through `@portfolio/telemetry-sdk`.

```bash
OBSERVABILITY_API_URL=http://localhost:8000 DEMO_TRACE_COUNT=9 npm run demo:agent
```

No provider API keys are required. The traces use mock prompts, estimated/demo token costs and occasional warning/error paths so the dashboard has meaningful data.
