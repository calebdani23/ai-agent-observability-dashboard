import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import { datasetLabel, datasetNotice, datasetOptions, defaultDataset } from "../api/datasets";
import type { TraceDataset } from "../api/types";
import { BarPanel } from "../components/Charts";
import { Card, DataNotice, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from "../components/ui";
import { ms, usd } from "../utils/format";

export function AnalyticsPage() {
  const session = useQuery({ queryKey: ["openai-session-status"], queryFn: apiClient.openAISessionStatus, retry: false });
  const [dataset, setDataset] = useState<TraceDataset>("all_real");
  useEffect(() => { if (session.data) setDataset(defaultDataset(session.data)); }, [session.data?.connected]);
  const models = useQuery({ queryKey: ["analytics-models", dataset], queryFn: () => apiClient.models(dataset), enabled: !session.isLoading });
  const traces = useQuery({ queryKey: ["analytics-traces", dataset], queryFn: () => apiClient.traces({ dataset, limit: 200 }), enabled: !session.isLoading });
  const tools = useQuery({ queryKey: ["analytics-tools", dataset], queryFn: () => apiClient.tools(dataset), enabled: !session.isLoading });
  const errors = useQuery({ queryKey: ["analytics-errors", dataset], queryFn: () => apiClient.errors(dataset), enabled: !session.isLoading });
  if (session.isLoading || models.isLoading || traces.isLoading || tools.isLoading) return <LoadingState />;
  if (models.isError || traces.isError || tools.isError || errors.isError) return <ErrorState error={models.error ?? traces.error ?? tools.error ?? errors.error} />;
  const traceItems = traces.data?.data.items ?? [];
  const appTokens = Object.values(traceItems.reduce<Record<string, { app: string; tokens: number }>>((acc, t) => { acc[t.app_name] ??= { app: t.app_name, tokens: 0 }; acc[t.app_name].tokens += t.total_tokens; return acc; }, {}));
  const slowest = [...traceItems].sort((a, b) => b.latency_ms - a.latency_ms).slice(0, 5);
  const expensive = [...traceItems].sort((a, b) => Number(b.estimated_cost_usd) - Number(a.estimated_cost_usd)).slice(0, 5);
  const fallbackNotice = models.data?.notice ?? traces.data?.notice ?? tools.data?.notice;
  const notice = fallbackNotice ?? datasetNotice(dataset, Boolean(session.data?.connected));
  const source = fallbackNotice ? "local-demo" : models.data?.source ?? traces.data?.source ?? tools.data?.source;
  return (
    <main>
      <PageHeader eyebrow="Analytics" title={`${datasetLabel(dataset)} analytics`}>Estimated/demo values for model spend, slow operations, tool usage and error concentration.</PageHeader>
      <div className="filter-bar">{datasetOptions.filter((option) => session.data?.connected || !option.requiresSession).map((option) => <button key={option.value} type="button" className={`button ${dataset === option.value ? "primary" : ""}`} onClick={() => setDataset(option.value)}>{option.label}</button>)}</div>
      <DataNotice source={source} notice={notice} />
      {traceItems.length === 0 && dataset === "current_openai_session" ? <EmptyState message={session.data?.connected ? "No analytics for this OpenAI session yet." : "No active OpenAI session."}><p className="muted">Run a prompt first; current-session analytics never fall back to demo charts.</p><Link className="button primary" to="/openai-run">Run a prompt</Link></EmptyState> : null}
      <section className="chart-grid"><BarPanel title="Cost by model" data={models.data?.data ?? []} xKey="model" bars={[{ key: "cost", color: "#f59e0b" }]} /><BarPanel title="Tokens by app" data={appTokens} xKey="app" bars={[{ key: "tokens", color: "#38bdf8" }]} /><BarPanel title="Tool usage frequency" data={tools.data?.data ?? []} xKey="tool" bars={[{ key: "count", color: "#22c55e" }]} /><BarPanel title="Error rate by operation/type" data={errors.data?.data ?? []} xKey="operation" bars={[{ key: "count", color: "#ef4444" }]} /></section>
      <section className="two-col"><Ranked title="Slowest operations" rows={slowest.map((t) => ({ name: t.operation, value: ms(t.latency_ms), status: t.status }))} /><Ranked title="Most expensive traces" rows={expensive.map((t) => ({ name: t.operation, value: usd(t.estimated_cost_usd), status: t.status }))} /></section>
    </main>
  );
}

function Ranked({ title, rows }: { title: string; rows: { name: string; value: string; status: string }[] }) { return <Card title={title}><div className="ranked-list">{rows.map((row, index) => <div key={`${row.name}-${index}`}><span>{index + 1}. {row.name}</span><strong>{row.value}</strong><StatusBadge status={row.status} /></div>)}{rows.length === 0 && <p className="muted">No traces available.</p>}</div></Card>; }
