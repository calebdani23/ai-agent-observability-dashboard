import type { QueryClient } from "@tanstack/react-query";

export const workspaceQueryPrefixes = [
  "overview",
  "timeseries",
  "models",
  "errors",
  "traces",
  "trace",
  "analytics-models",
  "analytics-traces",
  "analytics-tools",
  "analytics-errors",
  "openai-session",
  "provider-keys",
] as const;

export function invalidateWorkspaceQueries(queryClient: QueryClient) {
  return Promise.all(workspaceQueryPrefixes.map((prefix) => queryClient.invalidateQueries({ queryKey: [prefix] })));
}
