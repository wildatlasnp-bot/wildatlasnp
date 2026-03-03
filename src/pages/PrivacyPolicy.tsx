import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background max-w-lg mx-auto px-5 py-8">
    <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
      <ArrowLeft size={16} />
      Back
    </Link>
    <h1 className="text-2xl font-heading font-bold text-foreground mb-6">Privacy Policy</h1>
    <div className="space-y-5 text-sm text-muted-foreground leading-relaxed font-body">
      <p className="text-xs text-muted-foreground/60">Effective Date: January 1, 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">1. Information We Collect</h2>
        <p>WildAtlas collects the following information when you create an account and use our service:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Email address</strong> — used for account authentication, waitlist registration, and service communications.</li>
          <li><strong className="text-foreground">Permit watch preferences</strong> — the Yosemite permits you choose to monitor (e.g., Half Dome, Upper Pines), stored to provide personalized tracking.</li>
          <li><strong className="text-foreground">Usage data</strong> — basic interaction data to improve the app experience.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">2. How We Use Your Data</h2>
        <p>Your data is used exclusively to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Provide and personalize the permit monitoring service.</li>
          <li>Send notifications about permit availability (when enabled).</li>
          <li>Manage your WildAtlas Pro waitlist status.</li>
        </ul>
        <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">3. Data Storage & Security</h2>
        <p>All data is stored securely using industry-standard encryption and access controls. Your information is protected by row-level security policies ensuring only you can access your own data.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">4. 2026 Compliance</h2>
        <p>WildAtlas is designed to comply with applicable 2026 data privacy regulations. You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access all personal data we store about you.</li>
          <li>Request deletion of your account and associated data.</li>
          <li>Opt out of non-essential communications at any time.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">5. Contact</h2>
        <p>For privacy-related inquiries, please reach out to us through the app's support channel.</p>
      </section>

      <p className="text-xs text-muted-foreground/50 pt-4 border-t border-border">© 2026 WildAtlas. All Rights Reserved.</p>
    </div>
  </div>
);

export default PrivacyPolicy;
