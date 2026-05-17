import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { DataResult, DataSource } from "../api/types";
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
  const overview = useQuery({ queryKey: ["overview"], queryFn: apiClient.overview });
  const timeseries = useQuery({ queryKey: ["timeseries"], queryFn: apiClient.timeseries });
  const models = useQuery({ queryKey: ["models"], queryFn: apiClient.models });
  const errors = useQuery({ queryKey: ["errors"], queryFn: apiClient.errors });
  if (overview.isLoading) return <LoadingState />;
  if (overview.isError) return <ErrorState error={overview.error} />;
  if (timeseries.isError || models.isError || errors.isError) return <ErrorState error={timeseries.error ?? models.error ?? errors.error} />;
  const result = overview.data!;
  const sourceNotice = dashboardSourceNotice([overview.data, timeseries.data, models.data, errors.data]);
  const data = result.data;
  return (
    <main>
      <PageHeader eyebrow="Overview" title="Live AI usage control room">Track request volume, latency, errors and estimated model spend.</PageHeader>
      <DataNotice source={sourceNotice.source} notice={sourceNotice.notice} />
      {data.total_requests === 0 ? <EmptyState message="No live traces yet." /> : null}
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
