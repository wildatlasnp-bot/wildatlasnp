import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const TermsOfService = () => (
  <div className="min-h-screen bg-background max-w-lg mx-auto px-5 py-8">
    <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
      <ArrowLeft size={16} />
      Back
    </Link>
    <h1 className="text-2xl font-heading font-bold text-foreground mb-6">Terms of Service</h1>
    <div className="space-y-5 text-sm text-muted-foreground leading-relaxed font-body">
      <p className="text-xs text-muted-foreground/60">Effective Date: January 1, 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">1. Nature of Service</h2>
        <p>WildAtlas is a <strong className="text-foreground">planning and informational tool</strong> designed to help outdoor enthusiasts monitor Yosemite National Park permit availability. We aggregate publicly available data to provide a convenient tracking experience.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">2. No Guarantee of Permit Availability</h2>
        <p className="font-medium text-foreground">WildAtlas does not guarantee permit availability.</p>
        <p>All permit inventory, cancellation data, and availability windows are sourced from Recreation.gov and other public channels. We have no control over:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Whether a permit will become available at any given time.</li>
          <li>The accuracy or timeliness of data provided by Recreation.gov.</li>
          <li>Your ability to successfully secure a permit once notified.</li>
        </ul>
        <p>WildAtlas is not affiliated with, endorsed by, or partnered with Recreation.gov, the National Park Service, or any government agency.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">3. User Responsibilities</h2>
        <p>By using WildAtlas, you agree to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Use the service for personal, non-commercial purposes only.</li>
          <li>Provide accurate account information.</li>
          <li>Not attempt to circumvent any access controls or security measures.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">4. Limitation of Liability</h2>
        <p>WildAtlas is provided "as is" without warranties of any kind. We are not liable for missed permits, inaccurate data, service downtime, or any damages arising from your use of the app.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">5. Changes to Terms</h2>
        <p>We may update these terms from time to time. Continued use of the service constitutes acceptance of updated terms.</p>
      </section>

      <p className="text-xs text-muted-foreground/50 pt-4 border-t border-border">© 2026 WildAtlas. All Rights Reserved.</p>
    </div>
  </div>
);

export default TermsOfService;
