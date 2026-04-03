import posthog from "posthog-js";

const CONSENT_KEY = "wildatlas_analytics_consent";

posthog.init("phc_XiAl29RrYEV1TVvGfO3rIrInfb1L1rKKjbyHSgAJzqW", {
  api_host: "https://us.i.posthog.com",
  autocapture: false,
  capture_pageview: true,
  persistence: "localStorage",
  opt_out_capturing_by_default: true,
});

// Restore previous consent choice
const storedConsent = localStorage.getItem(CONSENT_KEY);
if (storedConsent === "accepted") {
  posthog.opt_in_capturing();
} else {
  posthog.opt_out_capturing();
}

export default posthog;
