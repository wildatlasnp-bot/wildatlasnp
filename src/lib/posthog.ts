import posthog from "posthog-js";

posthog.init("phc_XiAl29RrYEV1TVvGfO3rIrInfb1L1rKKjbyHSgAJzqW", {
  api_host: "https://us.i.posthog.com",
  autocapture: false,
  capture_pageview: true,
  persistence: "localStorage",
});

export default posthog;
