import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("xlsx")) {
            return "xlsx";
          }
          if (id.includes("recharts")) {
            return "charts";
          }
          if (id.includes("@supabase")) {
            return "supabase";
          }
          if (id.includes("@tanstack")) {
            return "react-query";
          }
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul")) {
            return "radix-ui";
          }
          if (id.includes("react-router-dom")) {
            return "router";
          }
          if (id.includes("react-dom") || id.includes("react")) {
            return "react-core";
          }
          return "vendor";
        },
      },
    },
  },
}));
