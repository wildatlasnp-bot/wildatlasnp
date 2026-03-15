import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./lib/posthog"; // Initialize PostHog analytics
import { observeLongTasks } from "./lib/perf-telemetry";

observeLongTasks();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
