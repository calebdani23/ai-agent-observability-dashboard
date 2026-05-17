import type { ReactNode } from "react";
import type { DataSource } from "../api/types";
import { titleCase } from "../utils/format";

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <section className="page-header"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <p className="subtitle">{children}</p>}</section>;
}
export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{title && <h2>{title}</h2>}{children}</section>; }
export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) { return <Card className="metric-card"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</Card>; }
export function StatusBadge({ status }: { status: string }) { return <span className={`status-badge ${status}`}>{titleCase(status)}</span>; }
export function DataNotice({ source, notice }: { source?: DataSource; notice?: string }) { if (!source) return null; return <div className={`data-notice ${source}`}>{source === "live" ? "Live API data" : notice ?? "Local demo data"}</div>; }
export function LoadingState() { return <Card><p>Loading observability data…</p></Card>; }
export function EmptyState({ message }: { message: string }) { return <Card><p>{message}</p><p className="muted">Generate demo traces from the API or run the demo agent to populate this view.</p></Card>; }
export function ErrorState({ error }: { error: unknown }) { return <Card><p>Could not load live data.</p><p className="muted">{error instanceof Error ? error.message : "Unknown error"}</p></Card>; }
export function JsonBlock({ value }: { value: unknown }) { return <pre className="json-block">{typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)}</pre>; }
