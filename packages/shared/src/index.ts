export type TraceStatus = "success" | "error" | "warning";
export type StepType = "user_message" | "llm_call" | "tool_call" | "retrieval" | "final_response" | "error";
export type ToolStatus = "success" | "error";

export interface HealthResponse {
  status: "ok";
  service: "ai-agent-observability-api";
}

export interface TelemetryToolCall {
  toolName: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  status?: ToolStatus;
  latencyMs?: number;
  errorMessage?: string | null;
  createdAt?: string | Date;
}

export interface TelemetryTraceStep {
  stepType: StepType;
  name: string;
  input?: string | null;
  output?: string | null;
  metadata?: Record<string, unknown> | null;
  startedAt?: string | Date;
  endedAt?: string | Date | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  toolCalls?: TelemetryToolCall[];
}

export interface TelemetryTrace {
  appName: string;
  sessionId: string;
  userId?: string | null;
  operation: string;
  model: string;
  provider?: string;
  status?: TraceStatus;
  startedAt?: string | Date;
  endedAt?: string | Date | null;
  latencyMs?: number | null;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  steps?: TelemetryTraceStep[];
}
