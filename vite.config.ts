import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/WebcamArcade/" : "/",
  plugins: [react()],
  optimizeDeps: { include: ["@mediapipe/tasks-vision"] },
  server: { host: "127.0.0.1" },
}));
