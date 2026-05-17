import type { ErrorMetric, ModelMetric, OverviewMetrics, TimeseriesPoint, ToolMetric, Trace, TraceListResponse } from "../api/types";

const now = new Date("2026-05-17T12:00:00.000Z");
const iso = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();

export const demoTraceList: TraceListResponse = {
  total: 6,
  limit: 50,
  offset: 0,
  items: [
    trace("demo-travel-1", "travel-planning-agent", "plan_trip", "gpt-4.1-mini", "success", 2, 3210, 740, 3820, "search_flights"),
    trace("demo-code-1", "code-review-agent", "review_pull_request", "gpt-4o-mini", "warning", 5, 6110, 1200, 6900, "inspect_diff", "lint_warning"),
    trace("demo-support-1", "customer-support-agent", "resolve_ticket", "mock-fast", "error", 8, 1450, 380, 2420, "search_knowledge_base", "tool_timeout"),
    trace("demo-travel-2", "travel-planning-agent", "compare_hotels", "claude-3.5-haiku", "success", 20, 2720, 630, 2980, "compare_hotels"),
    trace("demo-code-2", "code-review-agent", "security_review", "gpt-4.1-mini", "success", 28, 8040, 1510, 8120, "lookup_docs"),
    trace("demo-support-2", "customer-support-agent", "refund_triage", "gpt-4o-mini", "warning", 36, 1880, 520, 3180, "create_ticket_note", "policy_escalation"),
  ],
};

export const demoOverview: OverviewMetrics = {
  total_requests: 126,
  total_tokens: 438_900,
  total_cost: 0.4128,
  avg_latency_ms: 3860,
  error_rate: 7.1,
  tool_calls: 214,
  active_apps: 3,
  sessions: 89,
};

export const demoTimeseries: TimeseriesPoint[] = Array.from({ length: 10 }, (_, i) => ({
  date: new Date(now.getTime() - (9 - i) * 86400000).toISOString().slice(0, 10),
  requests: 8 + i * 3 + (i % 2) * 4,
  tokens: 19000 + i * 4700,
  cost: Number((0.018 + i * 0.0042).toFixed(4)),
  avg_latency_ms: 2900 + (i % 4) * 430,
}));

export const demoModels: ModelMetric[] = [
  { model: "gpt-4.1-mini", requests: 46, input_tokens: 148000, output_tokens: 39200, total_tokens: 187200, cost: 0.1218, avg_latency_ms: 4210 },
  { model: "gpt-4o-mini", requests: 52, input_tokens: 132500, output_tokens: 48800, total_tokens: 181300, cost: 0.0492, avg_latency_ms: 3180 },
  { model: "claude-3.5-haiku", requests: 18, input_tokens: 39100, output_tokens: 14200, total_tokens: 53300, cost: 0.0881, avg_latency_ms: 5120 },
  { model: "mock-fast", requests: 10, input_tokens: 12400, output_tokens: 4700, total_tokens: 17100, cost: 0.0011, avg_latency_ms: 920 },
];

export const demoErrors: ErrorMetric[] = [
  { error_type: "tool_timeout", app_name: "customer-support-agent", operation: "resolve_ticket", count: 4 },
  { error_type: "rate_limit_retry_exhausted", app_name: "code-review-agent", operation: "security_review", count: 2 },
  { error_type: "policy_escalation", app_name: "travel-planning-agent", operation: "plan_trip", count: 1 },
];

export const demoTools: ToolMetric[] = Object.values(
  demoTraceList.items
    .flatMap((traceItem) => traceItem.steps.flatMap((step) => step.tool_calls))
    .reduce<Record<string, ToolMetric>>((acc, toolCall) => {
      acc[toolCall.tool_name] ??= { tool: toolCall.tool_name, count: 0 };
      acc[toolCall.tool_name].count += 1;
      return acc;
    }, {})
);

export function findDemoTrace(id: string) { return demoTraceList.items.find((item) => item.id === id); }

function trace(id: string, app: string, operation: string, model: string, status: Trace["status"], hoursAgo: number, input: number, output: number, latency: number, toolName: string, error?: string): Trace {
  const total = input + output;
  const started = iso(hoursAgo);
  const cost = Number(((input / 1_000_000) * 0.4 + (output / 1_000_000) * 1.6).toFixed(6));
  const stepBase = `${id}-step`;
  const toolId = `${id}-tool`;
  return {
    id, app_name: app, session_id: `session-${id.slice(-1)}${hoursAgo}7`, user_id: "demo-user", operation, model, provider: "mock", status,
    started_at: started, ended_at: iso(hoursAgo - latency / 3_600_000), latency_ms: latency, input_tokens: input, output_tokens: output, total_tokens: total, estimated_cost_usd: cost, error_message: error ?? null,
    metadata: { demo: true, system_prompt: "You are a careful AI agent. Minimize sensitive data exposure and cite tool outputs.", user_prompt: `Run ${operation} for a synthetic user request.`, structured_output: { confidence: status === "error" ? 0.42 : 0.88, next_action: status === "warning" ? "human_review" : "complete" } },
    steps: [
      { id: `${stepBase}-1`, trace_id: id, step_type: "user_message", name: "User request", input: `Synthetic request for ${operation}.`, output: null, metadata: { channel: "web" }, started_at: started, latency_ms: 24, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, tool_calls: [] },
      { id: `${stepBase}-2`, trace_id: id, step_type: "llm_call", name: "Plan next action", input: "System prompt + user intent (redacted demo).", output: `Plan: call ${toolName}, validate output, produce final answer.`, metadata: { temperature: 0.2 }, started_at: iso(hoursAgo - 0.01), latency_ms: Math.round(latency * 0.38), input_tokens: Math.round(input * 0.45), output_tokens: Math.round(output * 0.3), estimated_cost_usd: Number((cost * 0.42).toFixed(6)), tool_calls: [] },
      { id: `${stepBase}-3`, trace_id: id, step_type: "tool_call", name: toolName, input: JSON.stringify({ query: operation, demo: true }, null, 2), output: error ? "Tool failed before returning a complete result." : "Tool returned structured synthetic records for the agent.", metadata: { retry_count: error ? 2 : 0 }, started_at: iso(hoursAgo - 0.03), latency_ms: Math.round(latency * 0.28), input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, tool_calls: [{ id: toolId, trace_id: id, step_id: `${stepBase}-3`, tool_name: toolName, input: { query: operation, demo: true }, output: error ? null : { records: 4, source: "fixture" }, status: error ? "error" : "success", latency_ms: Math.round(latency * 0.28), error_message: error ?? null, created_at: iso(hoursAgo - 0.03) }] },
      { id: `${stepBase}-4`, trace_id: id, step_type: error ? "error" : "final_response", name: error ? "Failure handling" : "Final response", input: "Validated context and tool output.", output: error ? `Recoverable failure: ${error}. User-safe message prepared.` : "Final answer produced with estimated cost and safety notes.", metadata: { redaction: "Demo prompts avoid real personal data." }, started_at: iso(hoursAgo - 0.06), latency_ms: Math.round(latency * 0.27), input_tokens: Math.round(input * 0.55), output_tokens: Math.round(output * 0.7), estimated_cost_usd: Number((cost * 0.58).toFixed(6)), tool_calls: [] },
    ],
    tool_calls: [],
  };
}
