import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [react()],
  base: isProduction ? "/ai-agent-observability-dashboard/" : "/",
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
