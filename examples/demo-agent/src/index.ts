import { ObservabilityClient, type TraceStatus } from "@portfolio/telemetry-sdk";

const apiUrl = process.env.OBSERVABILITY_API_URL ?? "http://localhost:8000";
const apiKey = process.env.OBSERVABILITY_INGEST_API_KEY;
const count = Number(process.env.DEMO_TRACE_COUNT ?? process.env.COUNT ?? 9);
const models = ["gpt-4.1-mini", "gpt-4o-mini", "claude-3.5-haiku", "mock-fast"];
const scenarios = [
  { appName: "travel-planning-agent", operation: "plan_trip", tools: ["search_flights", "compare_hotels", "check_weather"], userPrompt: "Plan a 4-day Lisbon trip with a moderate budget." },
  { appName: "code-review-agent", operation: "review_pull_request", tools: ["inspect_diff", "lookup_docs", "run_static_analysis"], userPrompt: "Review a FastAPI + React pull request for risks." },
  { appName: "customer-support-agent", operation: "resolve_ticket", tools: ["search_knowledge_base", "fetch_order", "create_ticket_note"], userPrompt: "Help a customer understand a delayed order." },
];

async function main() {
  const created: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const scenario = scenarios[i % scenarios.length];
    const model = models[i % models.length];
    const client = new ObservabilityClient({ apiUrl, apiKey, appName: scenario.appName, defaultModel: model, defaultProvider: "mock", metadata: { generated_by: "examples/demo-agent" } });
    const status: TraceStatus = i % 7 === 3 ? "error" : i % 5 === 2 ? "warning" : "success";
    const inputTokens = 900 + i * 185;
    const outputTokens = 260 + i * 77;
    const tool = scenario.tools[i % scenario.tools.length];
    const trace = client.createTrace({ sessionId: `demo-agent-session-${Math.floor(i / 3) + 1}`, operation: scenario.operation, model, metadata: { system_prompt: "You are a production-style AI agent. Redact sensitive values and cite tools.", user_prompt: scenario.userPrompt, scenario: scenario.appName } });
    client.addStep(trace.id, { stepType: "user_message", name: "Receive user request", input: scenario.userPrompt, latencyMs: 20, metadata: { source: "demo-agent" } });
    client.addStep(trace.id, { stepType: "llm_call", name: "Plan agent workflow", input: "System prompt + user request", output: `Plan to call ${tool}, validate output, then respond.`, latencyMs: 640 + i * 80, inputTokens: Math.round(inputTokens * 0.46), outputTokens: Math.round(outputTokens * 0.28) });
    const toolStep = client.addStep(trace.id, { stepType: "tool_call", name: tool, input: JSON.stringify({ query: scenario.operation, demo: true }), output: status === "error" ? "Tool timeout after retries." : "Tool returned synthetic structured data.", latencyMs: 220 + i * 93, metadata: { retry_count: status === "error" ? 2 : 0 } });
    client.recordToolCall(trace.id, { stepId: toolStep.id, toolName: tool, input: { query: scenario.operation, trace_index: i }, output: status === "error" ? null : { records: 2 + (i % 5), confidence: 0.8 }, status: status === "error" ? "error" : "success", latencyMs: 220 + i * 93, errorMessage: status === "error" ? "tool_timeout" : null });
    client.addStep(trace.id, { stepType: status === "error" ? "error" : "final_response", name: status === "error" ? "Recover and surface failure" : "Compose final response", input: "Tool output and policy notes", output: status === "error" ? "I could not complete the tool-backed action. Please retry." : "Agent completed the task with cited synthetic evidence.", latencyMs: 520 + i * 61, inputTokens: Math.round(inputTokens * 0.54), outputTokens: Math.round(outputTokens * 0.72), metadata: { redaction_notice: "No real customer or provider data used." } });
    const finished = client.finishTrace(trace.id, { status, errorMessage: status === "error" ? "tool_timeout" : status === "warning" ? "policy_escalation" : null });
    await client.sendTrace(finished.id);
    created.push(`${scenario.appName}/${scenario.operation}/${status}`);
  }
  console.log(`Created ${created.length} traces at ${apiUrl}`);
  console.log(created.join("\n"));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
