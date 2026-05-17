import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { TraceDetailPage } from "./pages/TraceDetailPage";
import { TracesPage } from "./pages/TracesPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Layout() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const demoMode = import.meta.env.VITE_DEMO_MODE !== "false";

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand-mark">
          <span className="brand-dot" /> AI Observability
        </NavLink>
        <nav className="nav-links" aria-label="Primary navigation">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/traces">Traces</NavLink>
          <NavLink to="/analytics">Analytics</NavLink>
        </nav>
        <div className="source-pill" title={`API target: ${apiUrl}`}>
          {demoMode ? "Demo fallback on" : "Live API only"}
        </div>
      </header>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/traces" element={<TracesPage />} />
        <Route path="/traces/:traceId" element={<TraceDetailPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Layout />
      </HashRouter>
    </QueryClientProvider>
  );
}
