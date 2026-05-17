import { demoErrors, demoModels, demoOverview, demoTimeseries, demoTools, demoTraceList, findDemoTrace } from "../data/demoData";
import { API_URL, DEMO_MODE } from "./config";
import type { DataResult, ErrorMetric, ModelMetric, OpenAIRunRequest, OpenAIRunResponse, OpenAISessionStatus, OverviewMetrics, TimeseriesPoint, ToolMetric, Trace, TraceDataset, TraceFilters, TraceListResponse } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!response.ok) throw await apiError(response);
  return response.json() as Promise<T>;
}

async function apiError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail?.message === "string") return Object.assign(new Error(detail.message), { traceId: detail.trace_id });
    if (typeof detail === "string") return new Error(detail);
  } catch { /* ignore invalid error JSON */ }
  return new Error(`${response.status} ${response.statusText}`);
}

function fallback<T>(data: T, error: unknown): DataResult<T> {
  if (!DEMO_MODE) throw error instanceof Error ? error : new Error("API unavailable");
  return { data, source: "local-demo", notice: "Live API unavailable. Showing deterministic local demo data." };
}

function datasetPath(path: string, dataset?: TraceDataset) {
  if (!dataset) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}dataset=${encodeURIComponent(dataset)}`;
}

function requestInitForDataset(dataset?: TraceDataset): RequestInit | undefined {
  return dataset === "current_openai_session" ? { credentials: "include" } : undefined;
}

function fallbackForDataset<T>(dataset: TraceDataset | undefined, data: T, error: unknown): DataResult<T> {
  if (dataset === "current_openai_session") throw error instanceof Error ? error : new Error("Current-session dataset unavailable");
  return fallback(data, error);
}

export const apiClient = {
  async overview(dataset?: TraceDataset): Promise<DataResult<OverviewMetrics>> {
    try { return { data: normalizeOverview(await request<Partial<OverviewMetrics>>(datasetPath("/api/metrics/overview", dataset), requestInitForDataset(dataset))), source: "live" }; }
    catch (error) { return fallbackForDataset(dataset, demoOverview, error); }
  },
  async timeseries(dataset?: TraceDataset): Promise<DataResult<TimeseriesPoint[]>> {
    try { return { data: (await request<TimeseriesPoint[]>(datasetPath("/api/metrics/timeseries", dataset), requestInitForDataset(dataset))).map(normalizeTimeseries), source: "live" }; }
    catch (error) { return fallbackForDataset(dataset, demoTimeseries, error); }
  },
  async models(dataset?: TraceDataset): Promise<DataResult<ModelMetric[]>> {
    try { return { data: (await request<ModelMetric[]>(datasetPath("/api/metrics/models", dataset), requestInitForDataset(dataset))).map(normalizeModel), source: "live" }; }
    catch (error) { return fallbackForDataset(dataset, demoModels, error); }
  },
  async tools(dataset?: TraceDataset): Promise<DataResult<ToolMetric[]>> {
    try { return { data: (await request<ToolMetric[]>(datasetPath("/api/metrics/tools", dataset), requestInitForDataset(dataset))).map(normalizeTool), source: "live" }; }
    catch (error) { return fallbackForDataset(dataset, demoTools, error); }
  },
  async errors(dataset?: TraceDataset): Promise<DataResult<ErrorMetric[]>> {
    try { return { data: await request<ErrorMetric[]>(datasetPath("/api/metrics/errors", dataset), requestInitForDataset(dataset)), source: "live" }; }
    catch (error) { return fallbackForDataset(dataset, demoErrors, error); }
  },
  async traces(filters: TraceFilters = {}): Promise<DataResult<TraceListResponse>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== "" && params.set(key, String(value)));
    try { return { data: normalizeTraceList(await request<TraceListResponse>(`/api/traces?${params}`, requestInitForDataset(filters.dataset))), source: "live" }; }
    catch (error) { return fallbackForDataset(filters.dataset, filterDemoTraces(filters), error); }
  },
  async trace(id: string): Promise<DataResult<Trace>> {
    try { return { data: normalizeTrace(await request<Trace>(`/api/traces/${id}`, { credentials: "include" })), source: "live" }; }
    catch (error) { return fallback(findDemoTrace(id) ?? demoTraceList.items[0], error); }
  },
  async generateDemo(count = 12) { return request<{ created: number; total_traces: number }>(`/api/demo/generate-traces?count=${count}`, { method: "POST" }); },
  openAISessionStatus() { return request<OpenAISessionStatus>("/api/openai/session", { credentials: "include" }); },
  connectOpenAI(apiKey: string) { return request<OpenAISessionStatus>("/api/openai/sessions", { method: "POST", credentials: "include", body: JSON.stringify({ api_key: apiKey }) }); },
  disconnectOpenAI() { return request<OpenAISessionStatus>("/api/openai/session", { method: "DELETE", credentials: "include" }); },
  async runOpenAI(payload: OpenAIRunRequest) {
    const result = await request<OpenAIRunResponse>("/api/openai/runs", { method: "POST", credentials: "include", body: JSON.stringify(payload) });
    return { ...result, trace: normalizeTrace(result.trace) };
  },
};

function asNumber(value: unknown, fallbackValue = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallbackValue; }
function normalizeOverview(input: Partial<OverviewMetrics>): OverviewMetrics { return { total_requests: asNumber(input.total_requests), total_tokens: asNumber(input.total_tokens), total_cost: asNumber(input.total_cost), avg_latency_ms: asNumber(input.avg_latency_ms), error_rate: asNumber(input.error_rate), tool_calls: asNumber(input.tool_calls), active_apps: asNumber(input.active_apps), sessions: asNumber(input.sessions) }; }
function normalizeTimeseries(p: Partial<TimeseriesPoint>): TimeseriesPoint { return { date: String(p.date ?? "unknown"), requests: asNumber(p.requests), tokens: asNumber(p.tokens), cost: asNumber(p.cost), avg_latency_ms: asNumber(p.avg_latency_ms) }; }
function normalizeModel(m: Partial<ModelMetric>): ModelMetric { return { model: String(m.model ?? "unknown"), requests: asNumber(m.requests), input_tokens: asNumber(m.input_tokens), output_tokens: asNumber(m.output_tokens), total_tokens: asNumber(m.total_tokens), cost: asNumber(m.cost), avg_latency_ms: asNumber(m.avg_latency_ms) }; }
function normalizeTool(t: Partial<ToolMetric>): ToolMetric { return { tool: String(t.tool ?? "unknown_tool"), count: asNumber(t.count) }; }
function normalizeTraceList(response: TraceListResponse): TraceListResponse { return { total: asNumber(response.total, response.items?.length ?? 0), limit: asNumber(response.limit, 50), offset: asNumber(response.offset, 0), items: (response.items ?? []).map(normalizeTrace) }; }
function normalizeTrace(t: Partial<Trace>): Trace { return { id: String(t.id ?? crypto.randomUUID()), app_name: String(t.app_name ?? "unknown-app"), session_id: String(t.session_id ?? "unknown-session"), user_id: t.user_id ?? null, operation: String(t.operation ?? "unknown_operation"), model: String(t.model ?? "mock-fast"), provider: String(t.provider ?? "mock"), status: (t.status ?? "success") as Trace["status"], started_at: String(t.started_at ?? new Date().toISOString()), ended_at: String(t.ended_at ?? t.started_at ?? new Date().toISOString()), latency_ms: asNumber(t.latency_ms), input_tokens: asNumber(t.input_tokens), output_tokens: asNumber(t.output_tokens), total_tokens: asNumber(t.total_tokens, asNumber(t.input_tokens) + asNumber(t.output_tokens)), estimated_cost_usd: asNumber(t.estimated_cost_usd), error_message: t.error_message ?? null, metadata: t.metadata ?? null, trace_kind: t.trace_kind ?? "other_real_ingest", is_current_openai_session_trace: t.is_current_openai_session_trace ?? null, steps: t.steps ?? [], tool_calls: t.tool_calls ?? [] }; }
function filterDemoTraces(filters: TraceFilters): TraceListResponse {
  let items = demoTraceList.items;
  if (filters.app_name) items = items.filter((t) => t.app_name === filters.app_name);
  if (filters.model) items = items.filter((t) => t.model === filters.model);
  if (filters.status) items = items.filter((t) => t.status === filters.status);
  if (filters.search) items = items.filter((t) => `${t.operation} ${t.session_id} ${t.app_name}`.toLowerCase().includes(filters.search!.toLowerCase()));
  const offset = filters.offset ?? 0; const limit = filters.limit ?? 50;
  return { total: items.length, limit, offset, items: items.slice(offset, offset + limit) };
}
