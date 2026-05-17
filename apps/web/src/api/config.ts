const LOCAL_API_URL = "http://localhost:8000";
const PRODUCTION_API_URL = "https://ai-agent-observability-api.onrender.com";

export const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? LOCAL_API_URL : PRODUCTION_API_URL)).replace(/\/$/, "");
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";
