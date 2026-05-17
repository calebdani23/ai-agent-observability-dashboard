import { Link } from "react-router-dom";
import { Card, PageHeader } from "../components/ui";

export function LandingPage() {
  const repoUrl = import.meta.env.VITE_REPO_URL;
  return (
    <main>
      <PageHeader eyebrow="AI engineering observability" title="AI Agent Observability Dashboard">
        Monitor LLM calls, tool usage, tokens, cost, latency and full agent traces from a polished dashboard built for AI product teams.
      </PageHeader>
      <div className="actions">
        <Link className="button primary" to="/dashboard">Open Dashboard</Link>
        <Link className="button secondary" to="/traces">View Demo Traces</Link>
        {repoUrl && <a className="button secondary" href={repoUrl}>GitHub Repository</a>}
      </div>
      <section className="feature-grid">
        <Card title="LLM monitoring"><p>Inspect model usage, token volumes, estimated cost, latency and status across multiple agent apps.</p></Card>
        <Card title="Agent trace timeline"><p>Open any execution and follow user input, LLM planning, retrieval, tools and final response chronologically.</p></Card>
        <Card title="Cost analytics"><p>Compare estimated spend by model, app and operation using backend metrics or clear local demo fallback.</p></Card>
        <Card title="Tool-call inspection"><p>Debug tool inputs, outputs, failures and retries without placing secrets or sensitive data in the frontend.</p></Card>
      </section>
    </main>
  );
}
