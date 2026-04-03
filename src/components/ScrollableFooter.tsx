import { Link } from "react-router-dom";

/**
 * Standardised legal footer shown at the very end of scrollable content
 * in the Discover, Settings, and other tabs.
 */
export default function ScrollableFooter() {
  return (
    <footer className="pt-10 pb-28 text-center">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12px] font-body" style={{ color: "#9CA3AF" }}>
        <span>© 2026 WildAtlas. All Rights Reserved.</span>
        <span className="hidden sm:inline" style={{ color: "rgba(156,163,175,0.4)" }}>·</span>
        <Link to="/privacy" className="hover:text-muted-foreground transition-colors">Privacy Policy</Link>
        <span style={{ color: "rgba(156,163,175,0.4)" }}>·</span>
        <Link to="/terms" className="hover:text-muted-foreground transition-colors">Terms of Service</Link>
      </div>
    </footer>
  );
}
