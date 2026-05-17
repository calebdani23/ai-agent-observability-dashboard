const LOCAL_API_URL = "http://localhost:8000";
const PRODUCTION_API_URL = "https://ai-agent-observability-api.onrender.com";
const DEFAULT_SUPABASE_URL = "https://cspmkzxmykpeuhejagnj.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QWuXmUUUgUTkw3Cq5RlzTA_fWTG-1r-";
const demoModeOverride = import.meta.env.VITE_DEMO_MODE;

export const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? LOCAL_API_URL : PRODUCTION_API_URL)).replace(/\/$/, "");
export const DEMO_MODE = demoModeOverride === "true" || (demoModeOverride === undefined && import.meta.env.DEV);
export const DATA_MODE_LABEL = DEMO_MODE ? "Demo fallback enabled" : "Live API only";
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
export const SUPABASE_AUTH_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
