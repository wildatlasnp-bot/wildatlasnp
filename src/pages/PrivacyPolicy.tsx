import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background max-w-lg mx-auto px-5 py-8 pb-20">
    <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
      <ArrowLeft size={16} />
      Back
    </Link>
    <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Privacy Policy</h1>
    <div className="space-y-5 text-sm text-muted-foreground leading-relaxed font-body">
      <p className="text-xs text-muted-foreground/60">Effective Date: March 6, 2026 · Last Updated: March 6, 2026</p>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">1. Information We Collect</h2>
        <p>WildAtlas collects the following information when you create an account and use our service:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Email address</strong> — used for account authentication, service communications, and permit alert notifications.</li>
          <li><strong className="text-foreground">Full name</strong> — used to personalize your in-app experience.</li>
          <li><strong className="text-foreground">Phone number</strong> — collected only when you voluntarily provide it to enable SMS permit alerts. Your phone number is used exclusively to send permit cancellation alerts for permits you are actively tracking. It is never used for marketing or shared with third parties.</li>
          <li><strong className="text-foreground">Permit watch preferences</strong> — the parks and permits you choose to monitor, stored to provide personalized tracking and alerts.</li>
          <li><strong className="text-foreground">Trip dates</strong> — if provided, used to personalize Mochi AI recommendations and countdown features.</li>
          <li><strong className="text-foreground">Usage data</strong> — basic interaction data including features used, screens visited, and session duration, used to improve the app experience.</li>
          <li><strong className="text-foreground">Device information</strong> — device type, operating system, and app version, used for technical support and app optimization.</li>
          <li><strong className="text-foreground">Payment information</strong> — if you subscribe to WildAtlas Pro, payment is processed by Stripe. WildAtlas does not store your full credit card number. Stripe's privacy policy governs payment data handling.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">2. How We Use Your Data</h2>
        <p>Your data is used exclusively to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Provide and personalize the permit monitoring and alert service.</li>
          <li>Send SMS permit alerts to your verified phone number when you have enabled this feature and hold an active Pro subscription.</li>
          <li>Send email notifications about permit availability when you have enabled this feature.</li>
          <li>Personalize Mochi AI responses based on your park preferences and trip dates.</li>
          <li>Process Pro subscription payments through Stripe.</li>
          <li>Improve app performance and user experience through anonymized usage analytics.</li>
          <li>Respond to support requests and feedback.</li>
        </ul>
        <p>We do not sell, rent, trade, or share your personal information with third parties for their marketing purposes under any circumstances.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">3. SMS Alerts &amp; TCPA Compliance</h2>
        <p>WildAtlas sends automated SMS text messages to users who have explicitly opted in to SMS alerts. By providing your phone number and enabling SMS alerts you are providing express written consent to receive automated permit alert text messages from WildAtlas.</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Frequency:</strong> Message frequency varies based on permit availability and the number of permits you are tracking. During peak permit seasons you may receive multiple alerts per day.</li>
          <li><strong className="text-foreground">Rates:</strong> Standard message and data rates may apply depending on your mobile carrier plan.</li>
          <li><strong className="text-foreground">Opt-out:</strong> You may stop receiving SMS alerts at any time by replying STOP to any alert message, by toggling off SMS Alerts in the app Settings screen, or by deleting your WildAtlas account. All opt-out requests are honored within 24 hours. After opting out you will receive one final confirmation text message and no further messages.</li>
          <li><strong className="text-foreground">Help:</strong> Reply HELP to any message for assistance or contact us at <a href="mailto:wildatlasnp@gmail.com" className="text-primary underline">wildatlasnp@gmail.com</a>.</li>
          <li><strong className="text-foreground">Retention:</strong> Your phone number will be permanently deleted from our systems within 30 days of account deletion or SMS opt-out.</li>
        </ul>
        <p>WildAtlas complies with the Telephone Consumer Protection Act (TCPA) and all applicable state SMS regulations.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">4. Data Storage &amp; Security</h2>
        <p>All user data is stored securely using industry-standard AES-256 encryption at rest and TLS 1.2 or higher encryption in transit. Access to user data is restricted to authorized WildAtlas personnel only and protected by row-level security policies.</p>
        <p>WildAtlas uses the following third-party services to operate the platform. Each provider's privacy policy governs their handling of any data shared with them:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Supabase</strong> — database and authentication infrastructure.</li>
          <li><strong className="text-foreground">Twilio</strong> — SMS delivery service.</li>
          <li><strong className="text-foreground">Stripe</strong> — payment processing.</li>
          <li><strong className="text-foreground">Anthropic</strong> — AI responses powering Mochi (note: conversation data may be processed to generate responses).</li>
        </ul>
        <p>We retain your personal data for as long as your account is active. If you delete your account all personal data is permanently deleted within 30 days except where retention is required by law.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">5. California Residents — CCPA</h2>
        <p>If you are a California resident you have the following rights under the California Consumer Privacy Act (CCPA):</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-foreground">Right to Know</strong> — you may request a copy of the personal information WildAtlas has collected about you in the past 12 months.</li>
          <li><strong className="text-foreground">Right to Delete</strong> — you may request deletion of your personal information subject to certain exceptions.</li>
          <li><strong className="text-foreground">Right to Opt-Out</strong> — WildAtlas does not sell personal information. You do not need to opt out of a sale because no sale occurs.</li>
          <li><strong className="text-foreground">Right to Non-Discrimination</strong> — we will not discriminate against you for exercising your CCPA rights.</li>
        </ul>
        <p>To exercise any of these rights contact us at <a href="mailto:privacy@wildatlas.app" className="text-primary underline">privacy@wildatlas.app</a>. We will respond to verified requests within 45 days.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">6. Children's Privacy — COPPA</h2>
        <p>WildAtlas is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided personal information we will delete it immediately. If you believe a child under 13 has provided us with personal information please contact us at <a href="mailto:privacy@wildatlas.app" className="text-primary underline">privacy@wildatlas.app</a>.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">7. Recreation.gov Disclaimer</h2>
        <p>WildAtlas is an independent service and is not affiliated with, endorsed by, or officially connected to Recreation.gov, the National Park Service, or any United States government agency. Permit availability data is monitored independently. Always confirm your booking directly on Recreation.gov.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">8. Your Rights &amp; Data Requests</h2>
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Access all personal data we store about you.</li>
          <li>Correct inaccurate personal data.</li>
          <li>Request deletion of your account and all associated data.</li>
          <li>Export your data in a portable format.</li>
          <li>Opt out of non-essential communications at any time.</li>
        </ul>
        <p>To submit any data request contact us at <a href="mailto:privacy@wildatlas.app" className="text-primary underline">privacy@wildatlas.app</a>. We will respond within 30 days.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">9. Contact Information</h2>
        <p>For privacy-related inquiries or data requests:</p>
        <ul className="list-none pl-0 space-y-1">
          <li>Email: <a href="mailto:privacy@wildatlas.app" className="text-primary underline">privacy@wildatlas.app</a></li>
          <li>Support: <a href="mailto:support@wildatlas.app" className="text-primary underline">support@wildatlas.app</a></li>
          <li>Website: <a href="https://wildatlasnp.lovable.app" className="text-primary underline">WildAtlas.com</a></li>
        </ul>
        <p className="pt-1">WildAtlas<br />Operated as a sole proprietorship<br />United States</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-heading font-semibold text-foreground">10. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. When we do we will update the "Last Updated" date at the top of this page and notify active users by email. Your continued use of WildAtlas after changes are posted constitutes acceptance of the updated policy.</p>
      </section>

      <p className="text-xs text-muted-foreground/50 pt-4 border-t border-border">© 2026 WildAtlas. All Rights Reserved.</p>
    </div>
  </div>
);

export default PrivacyPolicy;
