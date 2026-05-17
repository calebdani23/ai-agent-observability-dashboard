import { demoErrors, demoModels, demoOverview, demoTimeseries, demoTools, demoTraceList, findDemoTrace } from "../data/demoData";
import type { DataResult, ErrorMetric, ModelMetric, OverviewMetrics, TimeseriesPoint, ToolMetric, Trace, TraceFilters, TraceListResponse } from "./types";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

function fallback<T>(data: T, error: unknown): DataResult<T> {
  if (!DEMO_MODE) throw error instanceof Error ? error : new Error("API unavailable");
  return { data, source: "local-demo", notice: "Live API unavailable. Showing deterministic local demo data." };
}

export const apiClient = {
  async overview(): Promise<DataResult<OverviewMetrics>> {
    try { return { data: normalizeOverview(await request<Partial<OverviewMetrics>>("/api/metrics/overview")), source: "live" }; }
    catch (error) { return fallback(demoOverview, error); }
  },
  async timeseries(): Promise<DataResult<TimeseriesPoint[]>> {
    try { return { data: (await request<TimeseriesPoint[]>("/api/metrics/timeseries")).map(normalizeTimeseries), source: "live" }; }
    catch (error) { return fallback(demoTimeseries, error); }
  },
  async models(): Promise<DataResult<ModelMetric[]>> {
    try { return { data: (await request<ModelMetric[]>("/api/metrics/models")).map(normalizeModel), source: "live" }; }
    catch (error) { return fallback(demoModels, error); }
  },
  async tools(): Promise<DataResult<ToolMetric[]>> {
    try { return { data: (await request<ToolMetric[]>("/api/metrics/tools")).map(normalizeTool), source: "live" }; }
    catch (error) { return fallback(demoTools, error); }
  },
  async errors(): Promise<DataResult<ErrorMetric[]>> {
    try { return { data: await request<ErrorMetric[]>("/api/metrics/errors"), source: "live" }; }
    catch (error) { return fallback(demoErrors, error); }
  },
  async traces(filters: TraceFilters = {}): Promise<DataResult<TraceListResponse>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value !== undefined && value !== "" && params.set(key, String(value)));
    try { return { data: normalizeTraceList(await request<TraceListResponse>(`/api/traces?${params}`)), source: "live" }; }
    catch (error) { return fallback(filterDemoTraces(filters), error); }
  },
  async trace(id: string): Promise<DataResult<Trace>> {
    try { return { data: normalizeTrace(await request<Trace>(`/api/traces/${id}`)), source: "live" }; }
    catch (error) { return fallback(findDemoTrace(id) ?? demoTraceList.items[0], error); }
  },
  async generateDemo(count = 12) { return request<{ created: number; total_traces: number }>(`/api/demo/generate-traces?count=${count}`, { method: "POST" }); },
};

function asNumber(value: unknown, fallbackValue = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallbackValue; }
function normalizeOverview(input: Partial<OverviewMetrics>): OverviewMetrics { return { total_requests: asNumber(input.total_requests), total_tokens: asNumber(input.total_tokens), total_cost: asNumber(input.total_cost), avg_latency_ms: asNumber(input.avg_latency_ms), error_rate: asNumber(input.error_rate), tool_calls: asNumber(input.tool_calls), active_apps: asNumber(input.active_apps), sessions: asNumber(input.sessions) }; }
function normalizeTimeseries(p: Partial<TimeseriesPoint>): TimeseriesPoint { return { date: String(p.date ?? "unknown"), requests: asNumber(p.requests), tokens: asNumber(p.tokens), cost: asNumber(p.cost), avg_latency_ms: asNumber(p.avg_latency_ms) }; }
function normalizeModel(m: Partial<ModelMetric>): ModelMetric { return { model: String(m.model ?? "unknown"), requests: asNumber(m.requests), input_tokens: asNumber(m.input_tokens), output_tokens: asNumber(m.output_tokens), total_tokens: asNumber(m.total_tokens), cost: asNumber(m.cost), avg_latency_ms: asNumber(m.avg_latency_ms) }; }
function normalizeTool(t: Partial<ToolMetric>): ToolMetric { return { tool: String(t.tool ?? "unknown_tool"), count: asNumber(t.count) }; }
function normalizeTraceList(response: TraceListResponse): TraceListResponse { return { total: asNumber(response.total, response.items?.length ?? 0), limit: asNumber(response.limit, 50), offset: asNumber(response.offset, 0), items: (response.items ?? []).map(normalizeTrace) }; }
function normalizeTrace(t: Partial<Trace>): Trace { return { id: String(t.id ?? crypto.randomUUID()), app_name: String(t.app_name ?? "unknown-app"), session_id: String(t.session_id ?? "unknown-session"), user_id: t.user_id ?? null, operation: String(t.operation ?? "unknown_operation"), model: String(t.model ?? "mock-fast"), provider: String(t.provider ?? "mock"), status: (t.status ?? "success") as Trace["status"], started_at: String(t.started_at ?? new Date().toISOString()), ended_at: String(t.ended_at ?? t.started_at ?? new Date().toISOString()), latency_ms: asNumber(t.latency_ms), input_tokens: asNumber(t.input_tokens), output_tokens: asNumber(t.output_tokens), total_tokens: asNumber(t.total_tokens, asNumber(t.input_tokens) + asNumber(t.output_tokens)), estimated_cost_usd: asNumber(t.estimated_cost_usd), error_message: t.error_message ?? null, metadata: t.metadata ?? null, steps: t.steps ?? [], tool_calls: t.tool_calls ?? [] }; }
function filterDemoTraces(filters: TraceFilters): TraceListResponse {
  let items = demoTraceList.items;
  if (filters.app_name) items = items.filter((t) => t.app_name === filters.app_name);
  if (filters.model) items = items.filter((t) => t.model === filters.model);
  if (filters.status) items = items.filter((t) => t.status === filters.status);
  if (filters.search) items = items.filter((t) => `${t.operation} ${t.session_id} ${t.app_name}`.toLowerCase().includes(filters.search!.toLowerCase()));
  const offset = filters.offset ?? 0; const limit = filters.limit ?? 50;
  return { total: items.length, limit, offset, items: items.slice(offset, offset + limit) };
}
