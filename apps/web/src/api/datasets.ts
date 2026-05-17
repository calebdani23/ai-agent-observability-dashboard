import type { Trace, TraceDataset, TraceKind } from "./types";

export const datasetOptions: Array<{ value: TraceDataset; label: string; requiresSession?: boolean }> = [
  { value: "my_traces", label: "My private traces", requiresSession: true },
  { value: "demo", label: "Demo traces" },
  { value: "all", label: "Mine + demo", requiresSession: true },
];

export function defaultDataset(isAuthenticated: boolean): TraceDataset {
  return isAuthenticated ? "my_traces" : "demo";
}

export function datasetLabel(dataset: TraceDataset) {
  return datasetOptions.find((option) => option.value === dataset)?.label ?? "Selected traces";
}

export function datasetNotice(dataset: TraceDataset, connected: boolean) {
  if (dataset === "my_traces") return connected ? "Showing only private traces owned by your signed-in account." : "Sign in to view private traces. Showing public demo data when signed out.";
  if (dataset === "current_openai_session") {
    return connected
      ? "Showing only traces created from this browser's active temporary OpenAI session."
      : "No active OpenAI session. Connect an OpenAI key and run a prompt to create live traces.";
  }
  if (dataset === "all_real") return "Legacy live-trace dataset is owner-scoped on the backend and hidden from the public UI.";
  if (dataset === "demo") return "Showing demo/synthetic traces for exploration.";
  return "Showing your private traces alongside clearly marked demo telemetry.";
}

export function traceKindLabel(kind: TraceKind) {
  if (kind === "demo") return "Demo";
  if (kind === "real_web_session") return "Web OpenAI";
  return "Live ingest";
}

export function traceSourceNotice(trace: Trace) {
  if (trace.trace_kind === "demo") return "This is demo/synthetic telemetry.";
  if (trace.trace_kind === "real_web_session") return "This is your authenticated private web OpenAI trace.";
  return "This trace came from private live ingest/API telemetry.";
}
