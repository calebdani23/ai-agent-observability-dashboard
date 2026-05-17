# OpenAI Agent Example

Minimal real integration path that calls OpenAI with `OPENAI_API_KEY`, records an LLM/tool trace through `@portfolio/telemetry-sdk`, and sends it to the FastAPI backend.

```bash
OPENAI_API_KEY=replace-with-your-openai-api-key \
OBSERVABILITY_API_URL=http://localhost:8000 \
OBSERVABILITY_INGEST_API_KEY=replace-with-your-ingest-key \
npm run openai:agent
```

Optional variables: `OPENAI_MODEL` (defaults to `gpt-4o-mini`) and `OPENAI_AGENT_PROMPT`.

The example intentionally redacts the provider API key and sends only prompt/output telemetry plus a local mock tool result. Do not send private customer data unless your own instrumentation redacts it first.
