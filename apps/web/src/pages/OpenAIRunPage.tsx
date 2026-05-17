import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../api/client";
import type { OpenAISessionStatus } from "../api/types";
import { Card, PageHeader } from "../components/ui";

const models = ["gpt-4o-mini", "gpt-4.1-mini"];

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "The backend could not complete this request. Check CORS, cookies, and backend configuration.";
}

function errorTraceId(error: unknown) {
  return typeof error === "object" && error !== null && "traceId" in error ? String((error as { traceId?: unknown }).traceId ?? "") : "";
}

export function OpenAIRunPage() {
  const [session, setSession] = useState<OpenAISessionStatus>({ connected: false });
  const [checking, setChecking] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("Summarize one practical benefit of AI observability in two sentences.");
  const [model, setModel] = useState(models[0]);
  const [response, setResponse] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.openAISessionStatus()
      .then(setSession)
      .catch(() => setSession({ connected: false }))
      .finally(() => setChecking(false));
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy("connect"); setError(null); setResponse(null); setTraceId(null);
    try { const status = await apiClient.connectOpenAI(apiKey); setSession(status); setApiKey(""); }
    catch (err) { setError(errorMessage(err)); const failedTraceId = errorTraceId(err); if (failedTraceId) setTraceId(failedTraceId); }
    finally { setBusy(null); }
  }

  async function disconnect() {
    setBusy("disconnect"); setError(null);
    try { setSession(await apiClient.disconnectOpenAI()); setResponse(null); setTraceId(null); }
    catch (err) { setError(errorMessage(err)); const failedTraceId = errorTraceId(err); if (failedTraceId) setTraceId(failedTraceId); }
    finally { setBusy(null); }
  }

  async function run(event: FormEvent) {
    event.preventDefault();
    setBusy("run"); setError(null); setResponse(null); setTraceId(null);
    try { const result = await apiClient.runOpenAI({ prompt, model }); setResponse(result.response ?? ""); setTraceId(result.trace_id); }
    catch (err) { setError(errorMessage(err)); const failedTraceId = errorTraceId(err); if (failedTraceId) setTraceId(failedTraceId); }
    finally { setBusy(null); }
  }

  return (
    <main>
      <PageHeader eyebrow="Backend-run OpenAI" title="Run with your OpenAI key">
        Connect a personal OpenAI API key for a temporary, encrypted server-side session, then create a real trace from one backend-executed prompt.
      </PageHeader>
      <section className="two-col openai-layout">
        <Card title="Temporary server-side key session">
          <div className="data-notice warning"><strong>Privacy notice:</strong> your key is sent only to the backend, stored encrypted with a short TTL, and returned only as a hint. Prompts and model responses are stored as traces visible anywhere this public dashboard/API is visible. Do not submit sensitive prompts, secrets, or private data.</div>
          {checking ? <p>Checking session status…</p> : <><p className={session.connected ? "status-badge success inline" : "status-badge warning inline"}>{session.connected ? `Connected ${session.key_hint ? `(${session.key_hint})` : ""}` : "Not connected"}</p>{session.connected && session.expires_at && <p className="muted">Expires {new Date(session.expires_at).toLocaleString()}</p>}</>}
          {!session.connected ? (
            <form className="stack" onSubmit={connect}>
              <label>OpenAI API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." autoComplete="off" /></label>
              <button className="button primary" disabled={busy !== null || apiKey.trim().length < 20}>{busy === "connect" ? "Connecting…" : "Connect key"}</button>
            </form>
          ) : <button className="button secondary" onClick={disconnect} disabled={busy !== null}>{busy === "disconnect" ? "Disconnecting…" : "Disconnect and clear session"}</button>}
        </Card>
        <Card title="Run a prompt and create a trace">
          <form className="stack" onSubmit={run}>
            <label>Model<select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Prompt<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={8} maxLength={8000} /></label>
            <button className="button primary" disabled={!session.connected || busy !== null || !prompt.trim()}>{busy === "run" ? "Running on backend…" : "Run OpenAI and record trace"}</button>
          </form>
          {error && <div className="data-notice error">{error}</div>}
          {response !== null && <div className="result-box"><h3>OpenAI response</h3><p>{response}</p></div>}
          {traceId && <Link className="button secondary" to={`/traces/${traceId}`}>{error ? "Open failed trace" : "Open generated trace"}</Link>}
        </Card>
      </section>
    </main>
  );
}
