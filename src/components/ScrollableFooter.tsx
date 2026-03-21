import { Link } from "react-router-dom";

/**
 * Standardised legal footer shown at the very end of scrollable content
 * in the Discover, Alerts, and Settings tabs.
 */
export default function ScrollableFooter() {
  return (
    <footer className="pt-10 pb-28 text-center">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[11px] text-footer-muted font-body">
        <span>© 2026 WildAtlas. All Rights Reserved.</span>
        <span className="hidden sm:inline text-footer-muted/40">·</span>
        <Link to="/privacy" className="hover:text-muted-foreground transition-colors">Privacy Policy</Link>
        <span className="text-footer-muted/40">·</span>
        <Link to="/terms" className="hover:text-muted-foreground transition-colors">Terms of Service</Link>
      </div>
    </footer>
  );
}
