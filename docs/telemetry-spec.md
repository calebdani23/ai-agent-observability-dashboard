# Telemetry Specification

## Trace

An AI trace is one agent or LLM workflow execution. Core fields: `app_name`, `session_id`, optional `user_id`, `operation`, `model`, `provider`, `status`, timestamps, latency, token counts, estimated cost, optional error and metadata.

Statuses: `success`, `warning`, `error`.

## Trace step

A step is a chronological event within the trace: `user_message`, `llm_call`, `retrieval`, `tool_call`, `final_response` or `error`. Steps may include input/output text, metadata, latency, token counts and estimated step cost.

## Tool call

A tool call records an external action: tool name, JSON input, JSON output, `success`/`error` status, latency and optional error message. Tool calls may be attached to a step.

## JSON shape

```json
{
  "app_name": "code-review-agent",
  "session_id": "session_123",
  "operation": "review_pull_request",
  "model": "gpt-4.1-mini",
  "provider": "mock",
  "status": "success",
  "input_tokens": 1200,
  "output_tokens": 300,
  "metadata": { "system_prompt": "redacted", "user_prompt": "synthetic" },
  "steps": [
    {
      "step_type": "llm_call",
      "name": "analyze_repository",
      "input": "Analyze this codebase",
      "output": "Detected FastAPI backend and React frontend",
      "tool_calls": []
    }
  ]
}
```

The SDK accepts camelCase names (`sessionId`, `inputTokens`, `toolName`) and serializes them to this backend-compatible snake_case shape.

## Estimated cost

Costs are calculated from mock model pricing per 1M input/output tokens. They are useful for product analytics and demos but are not billing-grade.

## Sensitive data

Do not send real secrets, credentials, private customer content or provider keys. Prompt inspector views include a redaction notice; production instrumentation should redact before ingestion.
