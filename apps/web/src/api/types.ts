export type TraceStatus = "success" | "warning" | "error";
export type DataSource = "live" | "local-demo" | "error";

export interface ToolCall {
  id: string;
  trace_id: string;
  step_id?: string | null;
  tool_name: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  status: "success" | "error" | string;
  latency_ms: number;
  error_message?: string | null;
  created_at: string;
}

export interface TraceStep {
  id: string;
  trace_id: string;
  step_type: string;
  name: string;
  input?: string | null;
  output?: string | null;
  metadata?: Record<string, unknown> | null;
  started_at: string;
  ended_at?: string | null;
  latency_ms?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  estimated_cost_usd?: number | string | null;
  tool_calls: ToolCall[];
}

export interface Trace {
  id: string;
  app_name: string;
  session_id: string;
  user_id?: string | null;
  operation: string;
  model: string;
  provider: string;
  status: TraceStatus | string;
  started_at: string;
  ended_at: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number | string;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
  steps: TraceStep[];
  tool_calls: ToolCall[];
}

export interface TraceListResponse { total: number; limit: number; offset: number; items: Trace[]; }
export interface OverviewMetrics { total_requests: number; total_tokens: number; total_cost: number; avg_latency_ms: number; error_rate: number; tool_calls: number; active_apps: number; sessions: number; }
export interface TimeseriesPoint { date: string; requests: number; tokens: number; cost: number; avg_latency_ms: number; }
export interface ModelMetric { model: string; requests: number; input_tokens: number; output_tokens: number; total_tokens: number; cost: number; avg_latency_ms: number; }
export interface ToolMetric { tool: string; count: number; }
export interface ErrorMetric { error_type: string; app_name: string; operation: string; count: number; }

export interface DataResult<T> { data: T; source: DataSource; notice?: string; }
export interface TraceFilters { app_name?: string; model?: string; status?: string; search?: string; limit?: number; offset?: number; }

export interface OpenAISessionStatus { connected: boolean; expires_at?: string | null; key_hint?: string | null; }
export interface OpenAIRunRequest { prompt: string; model?: string; }
export interface OpenAIRunResponse { trace_id: string; trace: Trace; response?: string | null; status: TraceStatus | string; }
