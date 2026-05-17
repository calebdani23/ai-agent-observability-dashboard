import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { datasetLabel, datasetNotice, datasetOptions, defaultDataset } from "../api/datasets";
import type { TraceDataset } from "../api/types";
import { BarPanel } from "../components/Charts";
import { Card, DataNotice, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "../components/ui";
import { ms, usd } from "../utils/format";
import { useAuth } from "../auth/AuthContext";

export function AnalyticsPage() {
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const [dataset, setDataset] = useState<TraceDataset>((params.get("dataset") as TraceDataset) || defaultDataset(Boolean(auth.user)));
  useEffect(() => { if (!params.get("dataset")) setDataset(defaultDataset(Boolean(auth.user))); }, [auth.user?.id, params]);
  const models = useQuery({ queryKey: ["analytics-models", dataset, auth.user?.id], queryFn: () => apiClient.models(dataset), enabled: !auth.loading });
  const traces = useQuery({ queryKey: ["analytics-traces", dataset, auth.user?.id], queryFn: () => apiClient.traces({ dataset, limit: 200 }), enabled: !auth.loading });
  const tools = useQuery({ queryKey: ["analytics-tools", dataset, auth.user?.id], queryFn: () => apiClient.tools(dataset), enabled: !auth.loading });
  const errors = useQuery({ queryKey: ["analytics-errors", dataset, auth.user?.id], queryFn: () => apiClient.errors(dataset), enabled: !auth.loading });
  const providerKeys = useQuery({ queryKey: ["provider-keys", auth.user?.id], queryFn: () => apiClient.providerKeys(), enabled: Boolean(auth.user) && !auth.loading });
  if (auth.loading || models.isLoading || traces.isLoading || tools.isLoading) return <LoadingState />;
  if (models.isError || traces.isError || tools.isError || errors.isError) return <ErrorState error={models.error ?? traces.error ?? tools.error ?? errors.error} />;
  const traceItems = traces.data?.data.items ?? [];
  const appTokens = Object.values(traceItems.reduce<Record<string, { app: string; tokens: number }>>((acc, t) => { acc[t.app_name] ??= { app: t.app_name, tokens: 0 }; acc[t.app_name].tokens += t.total_tokens; return acc; }, {}));
  const slowest = [...traceItems].sort((a, b) => b.latency_ms - a.latency_ms).slice(0, 5);
  const expensive = [...traceItems].sort((a, b) => Number(b.estimated_cost_usd) - Number(a.estimated_cost_usd)).slice(0, 5);
  const fallbackNotice = models.data?.notice ?? traces.data?.notice ?? tools.data?.notice;
  const notice = fallbackNotice ?? datasetNotice(dataset, Boolean(auth.user));
  const source = fallbackNotice ? "local-demo" : models.data?.source ?? traces.data?.source ?? tools.data?.source;
  return (
    <main>
      <PageHeader eyebrow="Analytics" title={`${datasetLabel(dataset)} analytics`}>Estimated/demo values for model spend, slow operations, tool usage and error concentration.</PageHeader>
      <div className="filter-bar">{datasetOptions.filter((option) => auth.user || !option.requiresSession).map((option) => <button key={option.value} type="button" className={`button ${dataset === option.value ? "primary" : ""}`} onClick={() => { setDataset(option.value); const next = new URLSearchParams(params); next.set("dataset", option.value); setParams(next); }}>{option.label}</button>)}</div>
      <DataNotice source={source} notice={notice} />
      {traceItems.length === 0 && (dataset === "my_traces" || dataset === "current_openai_session") ? <AnalyticsEmptyState connected={Boolean(auth.user)} hasProviderKey={providerKeys.isLoading ? undefined : Boolean(providerKeys.data?.items.length)} /> : null}
      <section className="chart-grid"><BarPanel title="Cost by model" data={models.data?.data ?? []} xKey="model" bars={[{ key: "cost", color: "#f59e0b" }]} /><BarPanel title="Tokens by app" data={appTokens} xKey="app" bars={[{ key: "tokens", color: "#38bdf8" }]} /><BarPanel title="Tool usage frequency" data={tools.data?.data ?? []} xKey="tool" bars={[{ key: "count", color: "#22c55e" }]} /><BarPanel title="Error rate by operation/type" data={errors.data?.data ?? []} xKey="operation" bars={[{ key: "count", color: "#ef4444" }]} /></section>
      <section className="two-col"><Ranked title="Slowest operations" rows={slowest.map((t) => ({ name: t.operation, value: ms(t.latency_ms), status: t.status }))} /><Ranked title="Most expensive traces" rows={expensive.map((t) => ({ name: t.operation, value: usd(t.estimated_cost_usd), status: t.status }))} /></section>
    </main>
  );
}

function Ranked({ title, rows }: { title: string; rows: { name: string; value: string; status: string }[] }) { return <Card title={title}><div className="ranked-list">{rows.map((row, index) => <div key={`${row.name}-${index}`}><span>{index + 1}. {row.name}</span><strong>{row.value}</strong><StatusBadge status={row.status} /></div>)}{rows.length === 0 && <p className="muted">No traces available.</p>}</div></Card>; }

function AnalyticsEmptyState({ connected, hasProviderKey }: { connected: boolean; hasProviderKey?: boolean }) {
  if (!connected) return <EmptyState message="Signed-out demo visitor"><p className="muted">Sign in to view private analytics, or continue with clearly marked demo analytics.</p><div className="actions compact-actions"><Link className="button primary" to="/sign-in">Sign in</Link><Link className="button secondary" to="/analytics?dataset=demo">Explore demo analytics</Link></div></EmptyState>;
  if (hasProviderKey === undefined) return <EmptyState message="Checking private workspace…"><p className="muted">Looking for an encrypted provider key before recommending the next step.</p></EmptyState>;
  if (!hasProviderKey) return <EmptyState message="Save a provider key to unlock private analytics."><p className="muted">Private analytics never include another user's traces. Save an encrypted OpenAI key, then run a prompt to populate model spend, token, tool and error breakdowns.</p><div className="actions compact-actions"><Link className="button primary" to="/openai-run">Save provider key</Link><Link className="button secondary" to="/analytics?dataset=demo">Explore demo analytics</Link></div></EmptyState>;
  return <EmptyState message="Provider key saved — run your first prompt."><p className="muted">No private analytics exist yet. Run an OpenAI prompt to create live user-owned traces and metrics.</p><div className="actions compact-actions"><Link className="button primary" to="/openai-run">Run first prompt</Link><Link className="button secondary" to="/analytics?dataset=demo">Explore demo analytics</Link></div></EmptyState>;
}
