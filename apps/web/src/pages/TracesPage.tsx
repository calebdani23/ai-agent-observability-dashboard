import { useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { DataNotice, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "../components/ui";
import { compact, dateTime, ms, usd } from "../utils/format";

export function TracesPage() {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState({ app_name: params.get("app_name") ?? "", model: params.get("model") ?? "", status: params.get("status") ?? "", search: params.get("search") ?? "" });
  const filters = { ...form, limit: 50 };
  const traces = useQuery({ queryKey: ["traces", filters], queryFn: () => apiClient.traces(filters) });
  function submit(event: FormEvent) { event.preventDefault(); const next = new URLSearchParams(); Object.entries(form).forEach(([k, v]) => v && next.set(k, v)); setParams(next); traces.refetch(); }
  if (traces.isLoading) return <LoadingState />;
  if (traces.isError) return <ErrorState error={traces.error} />;
  const result = traces.data!;
  const items = result.data.items;
  return (
    <main>
      <PageHeader eyebrow="Trace explorer" title="Find and open agent executions">Filter by app, model, status or operation/session search.</PageHeader>
      <DataNotice source={result.source} notice={result.notice} />
      <form className="filter-bar" onSubmit={submit}>
        {(["app_name", "model", "status", "search"] as const).map((key) => <input key={key} placeholder={key.replace("_", " ")} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
        <button className="button primary">Apply filters</button>
      </form>
      {items.length === 0 ? <EmptyState message="No traces matched the current filters." /> : <div className="table-wrap"><table><thead><tr><th>Time</th><th>App</th><th>Session</th><th>Operation</th><th>Model</th><th>Tokens</th><th>Est. Cost</th><th>Latency</th><th>Status</th></tr></thead><tbody>{items.map((trace) => <tr key={trace.id}><td>{dateTime(trace.started_at)}</td><td>{trace.app_name}</td><td>{trace.session_id}</td><td><Link to={`/traces/${trace.id}`}>{trace.operation}</Link></td><td>{trace.model}</td><td>{compact(trace.total_tokens)}</td><td>{usd(trace.estimated_cost_usd)}</td><td>{ms(trace.latency_ms)}</td><td><StatusBadge status={trace.status} /></td></tr>)}</tbody></table></div>}
    </main>
  );
}
