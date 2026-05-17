import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { datasetLabel, datasetNotice, datasetOptions, defaultDataset, traceKindLabel } from "../api/datasets";
import type { TraceDataset } from "../api/types";
import { DataNotice, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "../components/ui";
import { compact, dateTime, ms, usd } from "../utils/format";

export function TracesPage() {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({ app_name: params.get("app_name") ?? "", model: params.get("model") ?? "", status: params.get("status") ?? "", search: params.get("search") ?? "" });
  const session = useQuery({ queryKey: ["openai-session-status"], queryFn: apiClient.openAISessionStatus, retry: false });
  const [dataset, setDataset] = useState<TraceDataset>((params.get("dataset") as TraceDataset) || "all_real");
  useEffect(() => { if (session.data && !params.get("dataset")) setDataset(defaultDataset(session.data)); }, [session.data?.connected]);
  const filters = { ...form, dataset, limit: 50 };
  const traces = useQuery({ queryKey: ["traces", filters], queryFn: () => apiClient.traces(filters), enabled: !session.isLoading });
  function submit(event: FormEvent) { event.preventDefault(); const next = new URLSearchParams(); Object.entries(form).forEach(([k, v]) => v && next.set(k, v)); next.set("dataset", dataset); setParams(next); traces.refetch(); }
  function selectDataset(nextDataset: TraceDataset) { setDataset(nextDataset); const next = new URLSearchParams(params); next.set("dataset", nextDataset); setParams(next); }
  if (session.isLoading || traces.isLoading) return <LoadingState />;
  if (traces.isError) return <ErrorState error={traces.error} />;
  const result = traces.data!;
  const items = result.data.items;
  return (
    <main>
      <PageHeader eyebrow="Trace explorer" title={`Find ${datasetLabel(dataset).toLowerCase()}`}>Filter by app, model, status or operation/session search.</PageHeader>
      <div className="filter-bar">{datasetOptions.filter((option) => session.data?.connected || !option.requiresSession).map((option) => <button key={option.value} type="button" className={`button ${dataset === option.value ? "primary" : ""}`} onClick={() => selectDataset(option.value)}>{option.label}</button>)}</div>
      <DataNotice source={result.source} notice={result.notice ?? datasetNotice(dataset, Boolean(session.data?.connected))} />
      <form className="filter-bar" onSubmit={submit}>
        {(["app_name", "model", "status", "search"] as const).map((key) => <input key={key} placeholder={key.replace("_", " ")} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
        <button className="button primary">Apply filters</button>
      </form>
      {items.length === 0 ? <TraceEmptyState dataset={dataset} connected={Boolean(session.data?.connected)} /> : <div className="table-wrap"><table><thead><tr><th>Time</th><th>Source</th><th>App</th><th>Session</th><th>Operation</th><th>Model</th><th>Tokens</th><th>Est. Cost</th><th>Latency</th><th>Status</th></tr></thead><tbody>{items.map((trace) => <tr key={trace.id}><td>{dateTime(trace.started_at)}</td><td><span className={`status-badge ${trace.trace_kind}`}>{traceKindLabel(trace.trace_kind)}</span></td><td>{trace.app_name}</td><td>{trace.session_id}</td><td><Link to={`/traces/${trace.id}`}>{trace.operation}</Link></td><td>{trace.model}</td><td>{compact(trace.total_tokens)}</td><td>{usd(trace.estimated_cost_usd)}</td><td>{ms(trace.latency_ms)}</td><td><StatusBadge status={trace.status} /></td></tr>)}</tbody></table></div>}
    </main>
  );
}

function TraceEmptyState({ dataset, connected }: { dataset: TraceDataset; connected: boolean }) {
  if (dataset === "current_openai_session") return <EmptyState message={connected ? "No traces have been recorded for this OpenAI session yet." : "No active OpenAI session."}><p className="muted">Only traces from this browser's active temporary OpenAI session are shown here.</p><Link className="button primary" to="/openai-run">Run a prompt to create your first live trace</Link></EmptyState>;
  if (dataset === "demo") return <EmptyState message="No demo traces matched the current filters."><p className="muted">Generate backend demo traces or clear filters to inspect seeded telemetry.</p></EmptyState>;
  return <EmptyState message="No traces matched the current filters." />;
}
