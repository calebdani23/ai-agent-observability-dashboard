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

  return <main><PageHeader eyebrow="Private workspace" title="Sign in to your observability workspace">Use Supabase Auth to persist your private traces and encrypted BYOK provider key server-side.</PageHeader><section className="two-col"><Card title={mode === "sign-in" ? "Sign in" : "Create account"}>{!auth.configured ? <div className="data-notice warning">Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.</div> : <form className="stack" onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label><button className="button primary" disabled={busy}>{busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}</button></form>}{error && <div className="data-notice error">{error}</div>}{message && <div className="data-notice success">{message}</div>}<button className="button secondary" type="button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button></Card><Card title="Public demo remains separate"><p className="muted">Signed-out visitors can still inspect clearly marked demo telemetry, but private real traces and metrics require an authenticated user.</p><Link className="button secondary" to="/dashboard">View demo dashboard</Link></Card></section></main>;
}
