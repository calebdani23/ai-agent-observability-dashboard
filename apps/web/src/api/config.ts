const LOCAL_API_URL = "http://localhost:8000";
const PRODUCTION_API_URL = "https://ai-agent-observability-api.onrender.com";
const demoModeOverride = import.meta.env.VITE_DEMO_MODE;

export const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? LOCAL_API_URL : PRODUCTION_API_URL)).replace(/\/$/, "");
export const DEMO_MODE = demoModeOverride === "true" || (demoModeOverride === undefined && import.meta.env.DEV);
export const DATA_MODE_LABEL = DEMO_MODE ? "Demo fallback enabled" : "Live API only";
