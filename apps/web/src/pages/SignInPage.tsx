import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Card, PageHeader } from "../components/ui";

export function SignInPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null); setMessage(null);
    try {
      if (mode === "sign-in") { await auth.signIn(email, password); navigate("/dashboard"); }
      else { await auth.signUp(email, password); setMessage("Account created. If email confirmation is enabled, confirm your email before signing in."); }
    } catch (err) { setError(err instanceof Error ? err.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  return (
    <main>
      <PageHeader eyebrow="Choose your workspace" title="Start with private observability or a guided demo">
        Sign in to record real, user-owned traces with encrypted provider-key storage, or continue as a visitor to explore clearly marked demo telemetry.
      </PageHeader>

      <section className="two-col entry-grid">
        <Card title={auth.user ? "You're signed in" : mode === "sign-in" ? "Sign in" : "Create account"}>
          <p className="muted">Authenticated private workspace</p>
          <ul className="guidance-list">
            <li>Private Dashboard, Traces and Analytics default to telemetry owned by your account.</li>
            <li>Save an OpenAI key encrypted on the backend, then run a prompt to create your first real trace.</li>
            <li>Demo data stays separate and visibly labeled when you choose to inspect it.</li>
          </ul>
          {auth.user ? (
            <div className="actions compact-actions">
              <Link className="button primary" to="/dashboard">Open private dashboard</Link>
              <Link className="button secondary" to="/openai-run">Save key / run prompt</Link>
            </div>
          ) : !auth.configured ? (
            <div className="data-notice warning">Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</div>
          ) : (
            <form className="stack" onSubmit={submit}>
              <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>
              <button className="button primary" disabled={busy}>{busy ? "Working…" : mode === "sign-in" ? "Sign in to private workspace" : "Create private workspace"}</button>
            </form>
          )}
          {error && <div className="data-notice error">{error}</div>}
          {message && <div className="data-notice success">{message}</div>}
          {!auth.user && <button className="button secondary" type="button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>}
        </Card>

        <Card title="Continue as a visitor">
          <p className="muted">Visitor/demo exploration mode</p>
          <ul className="guidance-list">
            <li>Explore deterministic demo metrics, traces, tool calls and errors without signing in.</li>
            <li>No provider keys are needed and no private workspace is created.</li>
            <li>When you are ready for real telemetry, return here and sign in.</li>
          </ul>
          <div className="actions compact-actions">
            <Link className="button primary" to="/dashboard?dataset=demo">Continue as visitor</Link>
            <Link className="button secondary" to="/welcome">Read project overview</Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
