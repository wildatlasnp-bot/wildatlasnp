import posthog from "posthog-js";

const consent = localStorage.getItem("wildatlas_analytics_consent");

posthog.init("phc_XiAl29RrYEV1TVvGfO3rIrInfb1L1rKKjbyHSgAJzqW", {
  api_host: "https://us.i.posthog.com",
  autocapture: false,
  capture_pageview: consent === "accepted",
  persistence: "localStorage",
  opt_out_capturing_by_default: true,
});

if (consent === "accepted") {
  posthog.opt_in_capturing();
}

export default posthog;
