import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiClient } from "../api/client";
import { traceKindLabel, traceSourceNotice } from "../api/datasets";
import { Card, DataNotice, ErrorState, JsonBlock, LoadingState, PageHeader, StatusBadge } from "../components/ui";
import { compact, dateTime, ms, titleCase, usd } from "../utils/format";

export function TraceDetailPage() {
  const { traceId = "" } = useParams();
  const trace = useQuery({ queryKey: ["trace", traceId], queryFn: () => apiClient.trace(traceId), enabled: Boolean(traceId) });
  if (trace.isLoading) return <LoadingState />;
  if (trace.isError) return <ErrorState error={trace.error} />;
  const result = trace.data!;
  const t = result.data;
  const metadata = t.metadata ?? {};
  const tools = [...t.tool_calls, ...t.steps.flatMap((step) => step.tool_calls ?? [])];
  return (
    <main>
      <PageHeader eyebrow="Trace detail" title={titleCase(t.operation)}>Inspect prompts, timeline steps, tools, tokens and estimated cost.</PageHeader>
      <DataNotice source={result.source} notice={result.notice} />
      <DataNotice source="live" notice={traceSourceNotice(t)} />
      <section className="summary-grid">
        <Card title="Summary"><dl className="details"><dt>Source</dt><dd>{traceKindLabel(t.trace_kind)}</dd><dt>App</dt><dd>{t.app_name}</dd><dt>Session</dt><dd>{t.session_id}</dd><dt>Model</dt><dd>{t.provider}/{t.model}</dd><dt>Status</dt><dd><StatusBadge status={t.status} /></dd><dt>Started</dt><dd>{dateTime(t.started_at)}</dd><dt>Latency</dt><dd>{ms(t.latency_ms)}</dd><dt>Tokens</dt><dd>{compact(t.total_tokens)}</dd><dt>Estimated cost</dt><dd>{usd(t.estimated_cost_usd)}</dd>{t.error_message && <><dt>Error</dt><dd>{t.error_message}</dd></>}</dl></Card>
        <Card title="Prompt inspector"><p className="muted">Sensitive data should be redacted before ingestion. Demo prompts are synthetic.</p><h3>System prompt</h3><JsonBlock value={metadata.system_prompt ?? "System prompt not supplied by this trace."} /><h3>User prompt</h3><JsonBlock value={metadata.user_prompt ?? t.steps[0]?.input} /><h3>Model response</h3><JsonBlock value={t.steps[t.steps.length - 1]?.output ?? "No model response captured."} /><h3>Structured output / metadata</h3><JsonBlock value={metadata.structured_output ?? metadata} /></Card>
      </section>
      <Card title="Execution timeline"><div className="timeline">{t.steps.map((step) => <details key={step.id} open className={`timeline-item ${step.step_type}`}><summary><span>{titleCase(step.step_type)}</span><strong>{step.name}</strong><em>{ms(step.latency_ms)}</em></summary><div className="timeline-body"><JsonBlock value={{ input: step.input, output: step.output, metadata: step.metadata, input_tokens: step.input_tokens, output_tokens: step.output_tokens, estimated_cost_usd: step.estimated_cost_usd }} /></div></details>)}</div></Card>
      <Card title="Tool calls">{tools.length === 0 ? <p className="muted">No tool calls were recorded for this trace.</p> : <div className="tool-grid">{tools.map((tool) => <article className="tool-card" key={tool.id}><header><strong>{tool.tool_name}</strong><StatusBadge status={tool.status} /></header><p>{ms(tool.latency_ms)} {tool.error_message ? `· ${tool.error_message}` : ""}</p><JsonBlock value={{ input: tool.input, output: tool.output }} /></article>)}</div>}</Card>
    </main>
  );
}
