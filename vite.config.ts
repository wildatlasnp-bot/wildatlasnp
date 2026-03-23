import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const resolveFromRoot = (relativePath: string) => path.resolve(__dirname, relativePath);

const reactEntry = resolveFromRoot("./node_modules/react/index.js");
const reactDomEntry = resolveFromRoot("./node_modules/react-dom/index.js");
const reactDomClientEntry = resolveFromRoot("./node_modules/react-dom/client.js");
const reactJsxRuntimeEntry = resolveFromRoot("./node_modules/react/jsx-runtime.js");
const reactJsxDevRuntimeEntry = resolveFromRoot("./node_modules/react/jsx-dev-runtime.js");

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
    alias: [
      { find: "@", replacement: resolveFromRoot("./src") },
      { find: /^react$/, replacement: reactEntry },
      { find: /^react-dom$/, replacement: reactDomEntry },
      { find: /^react-dom\/client$/, replacement: reactDomClientEntry },
      { find: /^react\/jsx-runtime$/, replacement: reactJsxRuntimeEntry },
      { find: /^react\/jsx-dev-runtime$/, replacement: reactJsxDevRuntimeEntry },
    ],
    dedupe: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
    force: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
}));
