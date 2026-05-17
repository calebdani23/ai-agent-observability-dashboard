import type { ReactNode } from "react";
import { API_URL, DEMO_MODE } from "../api/config";
import type { DataSource } from "../api/types";
import { titleCase } from "../utils/format";

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <section className="page-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <p className="subtitle">{children}</p>}</section>;
}
export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{title && <h2>{title}</h2>}{children}</section>; }
export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) { return <Card className="metric-card"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</Card>; }
export function StatusBadge({ status }: { status: string }) { return <span className={`status-badge ${status}`}>{titleCase(status)}</span>; }
export function DataNotice({ source, notice }: { source?: DataSource; notice?: string }) { if (!source && !notice) return null; const mode = DEMO_MODE ? "demo fallback enabled" : "live-only mode"; return <div className={`data-notice ${source ?? "live"}`}>{notice ?? (source === "live" ? `Live API data · ${mode}` : "Local demo data")}</div>; }
export function LoadingState() { return <Card><p>Loading observability data…</p></Card>; }
export function EmptyState({ message, children }: { message: string; children?: ReactNode }) { return <Card><p>{message}</p>{children ?? <p className="muted">Generate demo traces from the API or run the demo agent to populate this view.</p>}</Card>; }
export function ErrorState({ error }: { error: unknown }) { return <Card className="error-state"><p>Could not load live API data.</p><p className="muted">The frontend is in live-only mode, so demo fallback is disabled. Check the API target, backend health, and CORS settings.</p><p className="muted">API target: {API_URL}</p><p className="muted">{error instanceof Error ? error.message : "Unknown error"}</p></Card>; }
export function JsonBlock({ value }: { value: unknown }) { return <pre className="json-block">{typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)}</pre>; }
