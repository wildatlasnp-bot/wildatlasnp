import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const resolveFromRoot = (relativePath: string) => path.resolve(__dirname, relativePath);

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
      "@": resolveFromRoot("./src"),
      react: resolveFromRoot("./node_modules/react"),
      "react-dom": resolveFromRoot("./node_modules/react-dom"),
      "react/jsx-runtime": resolveFromRoot("./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": resolveFromRoot("./node_modules/react/jsx-dev-runtime.js"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
}));
