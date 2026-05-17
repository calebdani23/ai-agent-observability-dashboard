import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import { datasetLabel, datasetNotice, datasetOptions, defaultDataset } from "../api/datasets";
import type { DataResult, DataSource, TraceDataset } from "../api/types";
import { BarPanel, LinePanel } from "../components/Charts";
import { DataNotice, EmptyState, ErrorState, LoadingState, MetricCard, PageHeader } from "../components/ui";
import { compact, ms, percent, usd } from "../utils/format";

function dashboardSourceNotice(results: Array<DataResult<unknown> | undefined>): { source?: DataSource; notice?: string } {
  const sources = results.map((result) => result?.source).filter(Boolean);
  if (sources.length === 0) return {};
  const hasLive = sources.includes("live");
  const hasDemo = sources.includes("local-demo");
  if (hasLive && hasDemo) return { source: "local-demo", notice: "Mixed data sources: some dashboard panels use live API data, while others are showing local demo fallback data." };
  const source = sources[0];
  if (source === "local-demo") return { source, notice: results.find((result) => result?.source === "local-demo")?.notice };
  return { source };
}

export function DashboardPage() {
  const session = useQuery({ queryKey: ["openai-session-status"], queryFn: apiClient.openAISessionStatus, retry: false });
  const [dataset, setDataset] = useState<TraceDataset>("all_real");
  useEffect(() => { if (session.data) setDataset(defaultDataset(session.data)); }, [session.data?.connected]);
  const overview = useQuery({ queryKey: ["overview", dataset], queryFn: () => apiClient.overview(dataset), enabled: !session.isLoading });
  const timeseries = useQuery({ queryKey: ["timeseries", dataset], queryFn: () => apiClient.timeseries(dataset), enabled: !session.isLoading });
  const models = useQuery({ queryKey: ["models", dataset], queryFn: () => apiClient.models(dataset), enabled: !session.isLoading });
  const errors = useQuery({ queryKey: ["errors", dataset], queryFn: () => apiClient.errors(dataset), enabled: !session.isLoading });
  if (session.isLoading || overview.isLoading) return <LoadingState />;
  if (overview.isError) return <ErrorState error={overview.error} />;
  if (timeseries.isError || models.isError || errors.isError) return <ErrorState error={timeseries.error ?? models.error ?? errors.error} />;
  const result = overview.data!;
  const sourceNotice = dashboardSourceNotice([overview.data, timeseries.data, models.data, errors.data]);
  const data = result.data;
  return (
    <main>
      <PageHeader eyebrow="Overview" title={`${datasetLabel(dataset)} control room`}>Track request volume, latency, errors and estimated model spend.</PageHeader>
      <DatasetSelector dataset={dataset} connected={Boolean(session.data?.connected)} onChange={setDataset} />
      <DataNotice source={sourceNotice.source ?? "live"} notice={sourceNotice.notice ?? datasetNotice(dataset, Boolean(session.data?.connected))} />
      {data.total_requests === 0 ? <DatasetEmptyState dataset={dataset} connected={Boolean(session.data?.connected)} /> : null}
      <section className="metric-grid">
        <MetricCard label="Total Requests" value={compact(data.total_requests)} />
        <MetricCard label="Total Tokens" value={compact(data.total_tokens)} />
        <MetricCard label="Estimated Cost" value={usd(data.total_cost)} hint="demo pricing" />
        <MetricCard label="Average Latency" value={ms(data.avg_latency_ms)} />
        <MetricCard label="Error Rate" value={percent(data.error_rate)} />
        <MetricCard label="Tool Calls" value={compact(data.tool_calls)} />
        <MetricCard label="Active Apps" value={compact(data.active_apps)} />
        <MetricCard label="Sessions" value={compact(data.sessions)} />
      </section>
      <section className="chart-grid">
        <LinePanel title="Requests over time" data={timeseries.data?.data ?? []} lines={[{ key: "requests", color: "#38bdf8" }]} />
        <BarPanel title="Token usage by model" data={models.data?.data ?? []} xKey="model" bars={[{ key: "total_tokens", color: "#818cf8" }]} />
        <LinePanel title="Estimated cost by day" data={timeseries.data?.data ?? []} lines={[{ key: "cost", color: "#f59e0b" }]} />
        <LinePanel title="Latency trend" data={timeseries.data?.data ?? []} lines={[{ key: "avg_latency_ms", color: "#22c55e" }]} />
        <BarPanel title="Errors by type" data={errors.data?.data ?? []} xKey="error_type" bars={[{ key: "count", color: "#ef4444" }]} />
      </section>
    </main>
  );
}

function DatasetSelector({ dataset, connected, onChange }: { dataset: TraceDataset; connected: boolean; onChange: (dataset: TraceDataset) => void }) {
  return <div className="filter-bar">{datasetOptions.filter((option) => connected || !option.requiresSession).map((option) => <button key={option.value} type="button" className={`button ${dataset === option.value ? "primary" : ""}`} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

function DatasetEmptyState({ dataset, connected }: { dataset: TraceDataset; connected: boolean }) {
  if (dataset === "current_openai_session") return <EmptyState message={connected ? "No live traces in this OpenAI session yet." : "No active OpenAI session."}><p className="muted">Run a prompt to create your first live trace for this browser's temporary session.</p><Link className="button primary" to="/openai-run">Run a prompt</Link></EmptyState>;
  if (dataset === "demo") return <EmptyState message="No demo traces are available."><p className="muted">Generate demo traces from the API or switch to all live traces.</p></EmptyState>;
  return <EmptyState message="No traces are available for this dataset." />;
}
