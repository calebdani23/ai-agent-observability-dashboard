export type TraceStatus = "success" | "warning" | "error";
export type StepType = "user_message" | "llm_call" | "tool_call" | "retrieval" | "final_response" | "error";
export type ToolStatus = "success" | "error";

export interface ObservabilityClientOptions { apiUrl: string; appName: string; apiKey?: string; defaultProvider?: string; defaultModel?: string; defaultSessionId?: string; metadata?: Record<string, unknown>; }
export interface TraceInput { sessionId?: string; userId?: string; operation: string; model?: string; provider?: string; metadata?: Record<string, unknown>; }
export interface StepInput { stepType: StepType; name: string; input?: string | null; output?: string | null; metadata?: Record<string, unknown> | null; startedAt?: Date | string; endedAt?: Date | string | null; latencyMs?: number | null; inputTokens?: number | null; outputTokens?: number | null; estimatedCostUsd?: number | null; }
export interface ToolCallInput { stepId?: string; toolName: string; input?: Record<string, unknown>; output?: Record<string, unknown> | null; status?: ToolStatus; latencyMs?: number; errorMessage?: string | null; createdAt?: Date | string; }
export interface FinishInput { status?: TraceStatus; errorMessage?: string | null; outputTokens?: number; inputTokens?: number; metadata?: Record<string, unknown>; endedAt?: Date | string; latencyMs?: number; }

interface StepState extends StepInput { id: string; toolCalls: ToolCallInput[]; }
interface TraceState { id: string; appName: string; sessionId: string; userId?: string; operation: string; model: string; provider: string; status: TraceStatus; startedAt: Date; endedAt?: Date | string; latencyMs?: number; inputTokens: number; outputTokens: number; estimatedCostUsd?: number; errorMessage?: string | null; metadata: Record<string, unknown>; steps: StepState[]; }

const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = { "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 }, "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 }, "claude-3.5-haiku": { inputPer1M: 0.8, outputPer1M: 4 }, "mock-fast": { inputPer1M: 0.05, outputPer1M: 0.1 } };
const uuid = () => globalThis.crypto?.randomUUID?.() ?? `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const iso = (value?: Date | string | null) => value ? new Date(value).toISOString() : undefined;
export const estimateCostUsd = (model: string, inputTokens = 0, outputTokens = 0) => { const price = MODEL_PRICING[model] ?? MODEL_PRICING["mock-fast"]; return Number(((inputTokens / 1_000_000) * price.inputPer1M + (outputTokens / 1_000_000) * price.outputPer1M).toFixed(6)); };

export class ObservabilityClient {
  private traces = new Map<string, TraceState>();
  constructor(private readonly options: ObservabilityClientOptions) { if (!options.apiUrl) throw new Error("apiUrl is required"); if (!options.appName) throw new Error("appName is required"); }
  getConfig() { return { ...this.options }; }
  createTrace(input: TraceInput) {
    const trace: TraceState = { id: uuid(), appName: this.options.appName, sessionId: input.sessionId ?? this.options.defaultSessionId ?? `session-${Date.now()}`, userId: input.userId, operation: input.operation, model: input.model ?? this.options.defaultModel ?? "mock-fast", provider: input.provider ?? this.options.defaultProvider ?? "mock", status: "success", startedAt: new Date(), inputTokens: 0, outputTokens: 0, metadata: { ...(this.options.metadata ?? {}), ...(input.metadata ?? {}) }, steps: [] };
    this.traces.set(trace.id, trace); return trace;
  }
  addTraceStep(traceId: string, step: StepInput) { return this.addStep(traceId, step); }
  addStep(traceId: string, step: StepInput) { const trace = this.requireTrace(traceId); const state: StepState = { id: uuid(), startedAt: new Date(), ...step, toolCalls: [] }; trace.steps.push(state); return state; }
  recordToolCall(traceId: string, tool: ToolCallInput) { const trace = this.requireTrace(traceId); const call = { status: "success" as ToolStatus, latencyMs: 0, input: {}, ...tool }; const step = call.stepId ? trace.steps.find((candidate) => candidate.id === call.stepId) : trace.steps.at(-1); if (step) step.toolCalls.push(call); else trace.steps.push({ id: uuid(), stepType: "tool_call", name: call.toolName, startedAt: new Date(), toolCalls: [call] }); return call; }
  finishTrace(traceId: string, input: FinishInput = {}) { const trace = this.requireTrace(traceId); trace.status = input.status ?? trace.status; trace.errorMessage = input.errorMessage ?? trace.errorMessage; trace.endedAt = input.endedAt ?? new Date(); trace.latencyMs = input.latencyMs ?? Math.max(0, new Date(trace.endedAt).getTime() - trace.startedAt.getTime()); trace.inputTokens = input.inputTokens ?? trace.steps.reduce((sum, s) => sum + (s.inputTokens ?? 0), 0); trace.outputTokens = input.outputTokens ?? trace.steps.reduce((sum, s) => sum + (s.outputTokens ?? 0), 0); trace.estimatedCostUsd = estimateCostUsd(trace.model, trace.inputTokens, trace.outputTokens); trace.metadata = { ...trace.metadata, ...(input.metadata ?? {}) }; return trace; }
  async sendTrace(traceId: string) { const trace = this.requireTrace(traceId); if (!trace.endedAt) this.finishTrace(traceId); const headers: Record<string, string> = { "Content-Type": "application/json" }; if (this.options.apiKey) headers["X-Observability-Api-Key"] = this.options.apiKey; const response = await fetch(`${this.options.apiUrl.replace(/\/$/, "")}/api/traces`, { method: "POST", headers, body: JSON.stringify(toBackendPayload(trace)) }); if (!response.ok) throw new Error(`Failed to send trace: ${response.status} ${response.statusText}`); return response.json(); }
  private requireTrace(traceId: string) { const trace = this.traces.get(traceId); if (!trace) throw new Error(`Unknown trace ${traceId}`); return trace; }
}

function toBackendPayload(trace: TraceState) {
  return { app_name: trace.appName, session_id: trace.sessionId, user_id: trace.userId, operation: trace.operation, model: trace.model, provider: trace.provider, status: trace.status, started_at: iso(trace.startedAt), ended_at: iso(trace.endedAt), latency_ms: trace.latencyMs, input_tokens: trace.inputTokens, output_tokens: trace.outputTokens, estimated_cost_usd: trace.estimatedCostUsd, error_message: trace.errorMessage, metadata: trace.metadata, steps: trace.steps.map((step) => ({ step_type: step.stepType, name: step.name, input: step.input, output: step.output, metadata: step.metadata, started_at: iso(step.startedAt), ended_at: iso(step.endedAt), latency_ms: step.latencyMs, input_tokens: step.inputTokens, output_tokens: step.outputTokens, estimated_cost_usd: step.estimatedCostUsd, tool_calls: step.toolCalls.map((tool) => ({ tool_name: tool.toolName, input: tool.input ?? {}, output: tool.output, status: tool.status ?? "success", latency_ms: tool.latencyMs ?? 0, error_message: tool.errorMessage, created_at: iso(tool.createdAt) })) })) };
}
