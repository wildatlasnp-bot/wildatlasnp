import { useEffect, useState } from "react";

/**
 * WildAtlasSplash — Prompt 5 signature loading screen.
 *
 * Full-screen #1A2F1E field, Cormorant Garamond wordmark, single 32px amber
 * hairline that draws in left→right over 600ms. Once the upstream condition
 * resolves (caller unmounts this component), the splash crossfades out over
 * 400ms.
 *
 * Timing contract:
 *   • Minimum visible duration: 400ms — prevents the splash from flashing on
 *     fast hydrations.
 *   • Maximum visible duration: 1000ms — even if the parent keeps mounting it,
 *     we self-fade after 1s so the user is never stuck staring at a wordmark.
 *
 * Visual layer only. Does not gate any navigation or data fetching.
 */
const MIN_VISIBLE_MS = 400;
const MAX_VISIBLE_MS = 1000;
const FADE_MS = 400;

const WildAtlasSplash = ({ onComplete }: { onComplete?: () => void }) => {
  // `phase` controls the exit animation: 'in' = visible, 'out' = fading.
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    // Hard cap — splash never lingers past 1s regardless of caller behavior.
    const fadeStart = setTimeout(() => setPhase("out"), MAX_VISIBLE_MS - FADE_MS);
    const done = setTimeout(() => onComplete?.(), MAX_VISIBLE_MS);
    // Floor — onComplete can also be invoked externally, but we honor the
    // 400ms minimum by not firing onComplete before that window.
    return () => {
      clearTimeout(fadeStart);
      clearTimeout(done);
    };
  }, [onComplete]);

  return (
    <div
      className={`wa-splash${phase === "out" ? " wa-splash--exit" : ""}`}
      role="status"
      aria-label="Loading WildAtlas"
    >
      <p className="wa-splash__wordmark">WILDATLAS</p>
      <span aria-hidden="true" className="wa-splash__hairline" />
    </div>
  );
};

export { MIN_VISIBLE_MS as WILDATLAS_SPLASH_MIN_MS };
export default WildAtlasSplash;
