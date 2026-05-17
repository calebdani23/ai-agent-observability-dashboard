import type { OpenAISessionStatus, Trace, TraceDataset, TraceKind } from "./types";

export const datasetOptions: Array<{ value: TraceDataset; label: string; requiresSession?: boolean }> = [
  { value: "current_openai_session", label: "My live traces", requiresSession: true },
  { value: "all_real", label: "All live traces" },
  { value: "demo", label: "Demo traces" },
  { value: "all", label: "All traces" },
];

export function defaultDataset(session?: OpenAISessionStatus): TraceDataset {
  return session?.connected ? "current_openai_session" : "all_real";
}

export function datasetLabel(dataset: TraceDataset) {
  return datasetOptions.find((option) => option.value === dataset)?.label ?? "Selected traces";
}

export function datasetNotice(dataset: TraceDataset, connected: boolean) {
  if (dataset === "current_openai_session") {
    return connected
      ? "Showing only traces created from this browser's active temporary OpenAI session."
      : "No active OpenAI session. Connect an OpenAI key and run a prompt to create live traces.";
  }
  if (dataset === "all_real") return "Showing live non-demo traces from the backend.";
  if (dataset === "demo") return "Showing demo/synthetic traces for exploration.";
  return "Showing all traces, including demo and live telemetry.";
}

export function traceKindLabel(kind: TraceKind) {
  if (kind === "demo") return "Demo";
  if (kind === "real_web_session") return "Web OpenAI";
  return "Live ingest";
}

export function traceSourceNotice(trace: Trace) {
  if (trace.trace_kind === "demo") return "This is demo/synthetic telemetry.";
  if (trace.trace_kind === "real_web_session" && trace.is_current_openai_session_trace) return "This trace was created from your current OpenAI session.";
  if (trace.trace_kind === "real_web_session") return "This is a live web OpenAI trace. It may not belong to your current temporary session.";
  return "This trace came from live ingest/API telemetry.";
}
