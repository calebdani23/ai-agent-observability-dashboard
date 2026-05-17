import { useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { datasetLabel, datasetNotice, datasetOptions, defaultDataset, traceKindLabel } from "../api/datasets";
import type { TraceDataset } from "../api/types";
import { DataNotice, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "../components/ui";
import { compact, dateTime, ms, usd } from "../utils/format";
import { useAuth } from "../auth/AuthContext";

export function TracesPage() {
  const [params, setParams] = useSearchParams();
  const auth = useAuth();
  const [form, setForm] = useState({ app_name: params.get("app_name") ?? "", model: params.get("model") ?? "", status: params.get("status") ?? "", search: params.get("search") ?? "" });
  const [dataset, setDataset] = useState<TraceDataset>((params.get("dataset") as TraceDataset) || defaultDataset(Boolean(auth.user)));
  useEffect(() => { if (!params.get("dataset")) setDataset(defaultDataset(Boolean(auth.user))); }, [auth.user?.id]);
  const filters = { ...form, dataset, limit: 50 };
  const traces = useQuery({ queryKey: ["traces", filters, auth.user?.id], queryFn: () => apiClient.traces(filters), enabled: !auth.loading });
  function submit(event: FormEvent) { event.preventDefault(); const next = new URLSearchParams(); Object.entries(form).forEach(([k, v]) => v && next.set(k, v)); next.set("dataset", dataset); setParams(next); traces.refetch(); }
  function selectDataset(nextDataset: TraceDataset) { setDataset(nextDataset); const next = new URLSearchParams(params); next.set("dataset", nextDataset); setParams(next); }
  if (auth.loading || traces.isLoading) return <LoadingState />;
  if (traces.isError) return <ErrorState error={traces.error} />;
  const result = traces.data!;
  const items = result.data.items;
  return (
    <main>
      <PageHeader eyebrow="Trace explorer" title={`Find ${datasetLabel(dataset).toLowerCase()}`}>Filter by app, model, status or operation/session search.</PageHeader>
      <div className="filter-bar">{datasetOptions.filter((option) => auth.user || !option.requiresSession).map((option) => <button key={option.value} type="button" className={`button ${dataset === option.value ? "primary" : ""}`} onClick={() => selectDataset(option.value)}>{option.label}</button>)}</div>
      <DataNotice source={result.source} notice={result.notice ?? datasetNotice(dataset, Boolean(auth.user))} />
      <form className="filter-bar" onSubmit={submit}>
        {(["app_name", "model", "status", "search"] as const).map((key) => <input key={key} placeholder={key.replace("_", " ")} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
        <button className="button primary">Apply filters</button>
      </form>
      {items.length === 0 ? <TraceEmptyState dataset={dataset} connected={Boolean(auth.user)} /> : <div className="table-wrap"><table><thead><tr><th>Time</th><th>Source</th><th>App</th><th>Session</th><th>Operation</th><th>Model</th><th>Tokens</th><th>Est. Cost</th><th>Latency</th><th>Status</th></tr></thead><tbody>{items.map((trace) => <tr key={trace.id}><td>{dateTime(trace.started_at)}</td><td><span className={`status-badge ${trace.trace_kind}`}>{traceKindLabel(trace.trace_kind)}</span></td><td>{trace.app_name}</td><td>{trace.session_id}</td><td><Link to={`/traces/${trace.id}`}>{trace.operation}</Link></td><td>{trace.model}</td><td>{compact(trace.total_tokens)}</td><td>{usd(trace.estimated_cost_usd)}</td><td>{ms(trace.latency_ms)}</td><td><StatusBadge status={trace.status} /></td></tr>)}</tbody></table></div>}
    </main>
  );
}

function TraceEmptyState({ dataset, connected }: { dataset: TraceDataset; connected: boolean }) {
  if (dataset === "my_traces" || dataset === "current_openai_session") return <EmptyState message={connected ? "No private traces have been recorded yet." : "Sign in to view private traces."}><p className="muted">Only traces owned by your authenticated user are shown here. Save a provider key and run a prompt to generate the first inspectable trace timeline.</p><div className="actions compact-actions"><Link className="button primary" to={connected ? "/openai-run" : "/sign-in"}>{connected ? "Save key / run first prompt" : "Sign in"}</Link><Link className="button secondary" to="/traces?dataset=demo">Explore demo traces</Link></div></EmptyState>;
  if (dataset === "demo") return <EmptyState message="No demo traces matched the current filters."><p className="muted">Generate backend demo traces or clear filters to inspect seeded telemetry.</p></EmptyState>;
  return <EmptyState message="No traces matched the current filters." />;
}
