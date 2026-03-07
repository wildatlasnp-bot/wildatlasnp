import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const TermlyPrivacyPolicy = () => (
  <div className="min-h-screen bg-white">
    <div className="max-w-3xl mx-auto px-6 py-10 pb-24" style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#333" }}>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm mb-8 hover:opacity-70 transition-opacity" style={{ color: "#3b82f6" }}>
        <ArrowLeft size={16} />
        Back
      </Link>

      <h1 style={{ fontSize: "26px", fontWeight: 700, marginBottom: "4px" }}>PRIVACY POLICY</h1>
      <p style={{ fontSize: "14px", color: "#595959", marginBottom: "32px" }}>Last updated March 06, 2026</p>

      <div style={{ lineHeight: 1.7, fontSize: "15px" }}>
        {/* Intro */}
        <p style={{ marginBottom: 16 }}>
          This Privacy Notice for <strong>WildAtlas</strong> ("we," "us," or "our"), describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you:
        </p>
        <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
          <li style={{ marginBottom: 12 }}>Download and use our mobile application (WildAtlas), or any other application of ours that links to this Privacy Notice</li>
          <li style={{ marginBottom: 12 }}>
            Use WildAtlas. WildAtlas is a mobile application that monitors Recreation.gov for national park permit cancellations and availability. When a permit opening is detected, WildAtlas sends an instant SMS or email alert to users who have opted in to tracking that specific permit. WildAtlas also provides real-time crowd intelligence, seasonal park guidance, and an AI-powered park guide named Mochi to help users plan their national park visits. WildAtlas monitors permits for Yosemite, Mount Rainier, Zion, Glacier, Rocky Mountain, and Arches National Parks. WildAtlas is an independent service and is not affiliated with, endorsed by, or officially connected to Recreation.gov, the National Park Service, or any United States government agency.
          </li>
          <li style={{ marginBottom: 12 }}>Engage with us in other related ways, including any marketing or events</li>
        </ul>
        <p style={{ marginBottom: 24 }}>
          <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at{" "}
          <a href="mailto:wildatlasnp@gmail.com" style={{ color: "#3b82f6" }}>wildatlasnp@gmail.com</a>.
        </p>

        {/* SUMMARY */}
        <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: 12 }}>SUMMARY OF KEY POINTS</h2>
        <p style={{ marginBottom: 12, fontStyle: "italic" }}>
          This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for.
        </p>
        <ul style={{ paddingLeft: 0, listStyle: "none", marginBottom: 24 }}>
          {[
            { q: "What personal information do we process?", a: "When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about personal information you disclose to us." },
            { q: "Do we process any sensitive personal information?", a: "Some of the information may be considered \"special\" or \"sensitive\" in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information." },
            { q: "Do we collect any information from third parties?", a: "We do not collect any information from third parties." },
            { q: "How do we process your information?", a: "We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. Learn more about how we process your information." },
            { q: "In what situations and with which parties do we share personal information?", a: "We may share information in specific situations and with specific third parties. Learn more about when and with whom we share your personal information." },
            { q: "How do we keep your information safe?", a: "We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Learn more about how we keep your information safe." },
            { q: "What are your rights?", a: "Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. Learn more about your privacy rights." },
            { q: "How do you exercise your rights?", a: "The easiest way to exercise your rights is by visiting https://tally.so/r/XxGJXP, or by contacting us. We will consider and act upon any request in accordance with applicable data protection laws." },
          ].map((item, i) => (
            <li key={i} style={{ marginBottom: 12 }}>
              <strong>{item.q}</strong> {item.a}
            </li>
          ))}
        </ul>
        <p style={{ marginBottom: 24 }}>
          <strong>Want to learn more about what we do with any information we collect?</strong> Review the Privacy Notice in full.
        </p>

        {/* TABLE OF CONTENTS */}
        <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: 12 }}>TABLE OF CONTENTS</h2>
        <ol style={{ paddingLeft: 24, marginBottom: 32 }}>
          {[
            "WHAT INFORMATION DO WE COLLECT?",
            "HOW DO WE PROCESS YOUR INFORMATION?",
            "WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?",
            "DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?",
            "DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?",
            "HOW LONG DO WE KEEP YOUR INFORMATION?",
            "HOW DO WE KEEP YOUR INFORMATION SAFE?",
            "DO WE COLLECT INFORMATION FROM MINORS?",
            "WHAT ARE YOUR PRIVACY RIGHTS?",
            "CONTROLS FOR DO-NOT-TRACK FEATURES",
            "DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?",
            "DO WE MAKE UPDATES TO THIS NOTICE?",
            "HOW CAN YOU CONTACT US ABOUT THIS NOTICE?",
            "HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?",
          ].map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              <a href={`#section-${i + 1}`} style={{ color: "#3b82f6", textDecoration: "none" }}>{item}</a>
            </li>
          ))}
        </ol>

        {/* SECTION 1 */}
        <section id="section-1" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>1. WHAT INFORMATION DO WE COLLECT?</h2>
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: 8 }}>Personal information you disclose to us</h3>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> We collect personal information that you provide to us.</em></p>
          <p style={{ marginBottom: 12 }}>
            We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.
          </p>
          <p style={{ marginBottom: 8 }}><strong>Personal Information Provided by You.</strong> The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            {["names", "phone numbers", "email addresses", "usernames", "passwords", "contact preferences", "contact or authentication data", "debit/credit card numbers"].map((item, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginBottom: 12 }}><strong>Sensitive Information.</strong> We do not process sensitive information.</p>
          <p style={{ marginBottom: 12 }}>
            <strong>Payment Data.</strong> We may collect data necessary to process your payment if you choose to make purchases, such as your payment instrument number, and the security code associated with your payment instrument. All payment data is handled and stored by Stripe. You may find their privacy notice link(s) here:{" "}
            <a href="https://stripe.com/privacy" style={{ color: "#3b82f6" }} target="_blank" rel="noopener noreferrer">https://stripe.com/privacy</a>.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Data Retention</strong> — WildAtlas retains your personal information for as long as your account remains active. If you delete your account all personal data including your name, email address, phone number, permit preferences, and usage data will be permanently deleted from our systems within 30 days. Payment records may be retained for up to 7 years as required by tax and accounting regulations. Anonymized usage data that cannot be linked to any individual user may be retained indefinitely for service improvement purposes.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Do Not Track Signals</strong> — WildAtlas does not currently respond to Do Not Track signals from web browsers as there is no industry standard for how to respond to such signals. We do not track users across third party websites.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Links To Other Websites</strong> — The WildAtlas app and landing page contain links to Recreation.gov and other third party websites. WildAtlas is not responsible for the privacy practices of any third party websites. We encourage users to review the privacy policies of any external sites they visit. WildAtlas is not affiliated with Recreation.gov or the National Park Service.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Account Information</strong> — You may review, update, or delete your account information at any time by visiting the Settings screen within the WildAtlas app. To request complete account deletion email us at{" "}
            <a href="mailto:wildatlasnp@gmail.com" style={{ color: "#3b82f6" }}>wildatlasnp@gmail.com</a>{" "}
            with the subject line "Account Deletion Request." We will process all deletion requests within 30 days.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>California Shine The Light</strong> — California Civil Code Section 1798.83 also known as the Shine The Light law permits California residents to request information regarding our disclosure of personal information to third parties for their direct marketing purposes. WildAtlas does not disclose personal information to third parties for their direct marketing purposes. California residents may contact us at{" "}
            <a href="mailto:wildatlasnp@gmail.com" style={{ color: "#3b82f6" }}>wildatlasnp@gmail.com</a>{" "}
            for more information.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Security of Your Information</strong> — We use administrative, technical, and physical security measures to protect your personal information. All data is encrypted at rest using AES-256 encryption and in transit using TLS 1.2 or higher. Access to user data is restricted to authorized personnel only. While we have taken reasonable steps to secure the information you provide to us, no security measures are perfect or impenetrable and no method of data transmission can be guaranteed against interception or misuse.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Changes To This Policy</strong> — We may update this Privacy Policy from time to time. When we make material changes we will notify you by email at the address associated with your account and update the Last Updated date at the top of this policy. Your continued use of WildAtlas after any changes constitutes your acceptance of the updated Privacy Policy. We encourage you to review this policy periodically.
          </p>
          <p style={{ marginBottom: 16 }}>
            <strong>Contact Us</strong> — If you have questions or concerns about this Privacy Policy or our data practices contact us at:{" "}
            <a href="mailto:wildatlasnp@gmail.com" style={{ color: "#3b82f6" }}>wildatlasnp@gmail.com</a>. Response time: We typically respond within 24 hours. For account deletion requests use the subject line "Account Deletion Request." For data access requests use the subject line "Data Access Request." For all other privacy inquiries use the subject line "Privacy Inquiry."
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: 8 }}>Application Data</h3>
          <p style={{ marginBottom: 12 }}>If you use our application(s), we also may collect the following information if you choose to provide us with access or permission:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}>
              <strong>Mobile Device Access.</strong> We may request access or permission to certain features from your mobile device, including your mobile device's calendar, SMS messages, storage, push notifications, and other features. If you wish to change our access or permissions, you may do so in your device's settings.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Mobile Device Data.</strong> We automatically collect device information (such as your mobile device ID, model, and manufacturer), operating system, version information and system configuration information, device and application identification numbers, browser type and version, hardware model Internet service provider and/or mobile carrier, and Internet Protocol (IP) address (or proxy server). If you are using our application(s), we may also collect information about the phone network associated with your mobile device, your mobile device's operating system or platform, the type of mobile device you use, your mobile device's unique device ID, and information about the features of our application(s) you accessed.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong>Push Notifications.</strong> We may request to send you push notifications regarding your account or certain features of the application(s). If you wish to opt out from receiving these types of communications, you may turn them off in your device's settings.
            </li>
          </ul>
          <p style={{ marginBottom: 12 }}>
            This information is primarily needed to maintain the security and operation of our application(s), for troubleshooting, and for our internal analytics and reporting purposes.
          </p>
          <p style={{ marginBottom: 12 }}>
            All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.
          </p>

          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: 8 }}>Information automatically collected</h3>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> Some information — such as your Internet Protocol (IP) address and/or browser and device characteristics — is collected automatically when you visit our Services.</em></p>
          <p style={{ marginBottom: 12 }}>
            We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information. This information is primarily needed to maintain the security and operation of our Services, and for our internal analytics and reporting purposes.
          </p>
        </section>

        {/* SECTION 2 */}
        <section id="section-2" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>2. HOW DO WE PROCESS YOUR INFORMATION?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.</em></p>
          <p style={{ marginBottom: 12 }}>We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}>To facilitate account creation and authentication and otherwise manage user accounts.</li>
            <li style={{ marginBottom: 8 }}>To deliver and facilitate delivery of services to the user, including permit alerts via SMS and email.</li>
            <li style={{ marginBottom: 8 }}>To respond to user inquiries and offer support.</li>
            <li style={{ marginBottom: 8 }}>To send administrative information, such as changes to our terms, conditions, and policies.</li>
            <li style={{ marginBottom: 8 }}>To protect our Services, including fraud monitoring and prevention.</li>
            <li style={{ marginBottom: 8 }}>To evaluate and improve our Services, products, marketing, and your experience.</li>
          </ul>
        </section>

        {/* SECTION 3 */}
        <section id="section-3" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> We may share information in specific situations described in this section and/or with the following third parties.</em></p>
          <p style={{ marginBottom: 8 }}>We may need to share your personal information in the following situations:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 8 }}><strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
            <li style={{ marginBottom: 8 }}><strong>Third-Party Service Providers.</strong> We share data with Stripe (payments), Twilio (SMS delivery), Supabase (database & authentication), and Anthropic (AI responses for Mochi). Each provider's privacy policy governs their handling of shared data.</li>
          </ul>
        </section>

        {/* SECTION 4 */}
        <section id="section-4" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> We may use cookies and other tracking technologies to collect and store your information.</em></p>
          <p style={{ marginBottom: 12 }}>
            We may use cookies and similar tracking technologies (like web beacons and pixels) to gather information when you interact with our Services. Some online tracking technologies help us maintain the security of our Services and your account, prevent crashes, fix bugs, save your preferences, and assist with basic site functions.
          </p>
          <p style={{ marginBottom: 12 }}>
            We also permit third parties and service providers to use online tracking technologies on our Services for analytics and advertising, including to help manage and display advertisements, to tailor advertisements to your interests, or to send abandoned shopping cart reminders (depending on your communication preferences). The third parties and service providers use their technology to provide advertising about products and services tailored to your interests which may appear either on our Services or on other websites.
          </p>
        </section>

        {/* SECTION 5 */}
        <section id="section-5" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>5. DO WE OFFER ARTIFICIAL INTELLIGENCE-BASED PRODUCTS?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> We offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies.</em></p>
          <p style={{ marginBottom: 12 }}>
            As part of our Services, we offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies (collectively, "AI Products"). These tools are designed to enhance your experience and provide you with innovative solutions. The terms in this Privacy Notice govern your use of the AI Products within our Services.
          </p>
          <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: 8 }}>Our AI Products</h3>
          <p style={{ marginBottom: 12 }}>Our AI Products are designed for the following functions:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 4 }}>AI park guide (Mochi) for personalized national park recommendations</li>
            <li style={{ marginBottom: 4 }}>Seasonal and crowd-based trip planning guidance</li>
          </ul>
          <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: 8 }}>How We Process Your Data Using AI</h3>
          <p style={{ marginBottom: 12 }}>
            All personal information processed using our AI Products is handled in line with our Privacy Notice and our agreement with third parties. This ensures high security and safeguards your personal information throughout the process, giving you peace of mind about your data's safety.
          </p>
        </section>

        {/* SECTION 6 */}
        <section id="section-6" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>6. HOW LONG DO WE KEEP YOUR INFORMATION?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.</em></p>
          <p style={{ marginBottom: 12 }}>
            We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.
          </p>
          <p style={{ marginBottom: 12 }}>
            When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible.
          </p>
        </section>

        {/* SECTION 7 */}
        <section id="section-7" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>7. HOW DO WE KEEP YOUR INFORMATION SAFE?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> We aim to protect your personal information through a system of organizational and technical security measures.</em></p>
          <p style={{ marginBottom: 12 }}>
            We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.
          </p>
        </section>

        {/* SECTION 8 */}
        <section id="section-8" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>8. DO WE COLLECT INFORMATION FROM MINORS?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> We do not knowingly collect data from or market to children under 18 years of age.</em></p>
          <p style={{ marginBottom: 12 }}>
            We do not knowingly collect, solicit data from, or market to children under 18 years of age, nor do we knowingly sell such personal information. By using the Services, you represent that you are at least 18 or that you are the parent or guardian of such a minor and consent to such minor dependent's use of the Services. If we learn that personal information from users less than 18 years of age has been collected, we will deactivate the account and take reasonable measures to promptly delete such data from our records. If you become aware of any data we may have collected from children under age 18, please contact us at{" "}
            <a href="mailto:wildatlasnp@gmail.com" style={{ color: "#3b82f6" }}>wildatlasnp@gmail.com</a>.
          </p>
        </section>

        {/* SECTION 9 */}
        <section id="section-9" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>9. WHAT ARE YOUR PRIVACY RIGHTS?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.</em></p>
          <p style={{ marginBottom: 12 }}>
            <strong>Withdrawing your consent:</strong> If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us at{" "}
            <a href="mailto:wildatlasnp@gmail.com" style={{ color: "#3b82f6" }}>wildatlasnp@gmail.com</a>.
          </p>
          <p style={{ marginBottom: 12 }}>
            However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.
          </p>
          <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: 8 }}>Account Information</h3>
          <p style={{ marginBottom: 8 }}>If you would at any time like to review or change the information in your account or terminate your account, you can:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 12 }}>
            <li style={{ marginBottom: 4 }}>Log in to your account settings and update your user account.</li>
            <li style={{ marginBottom: 4 }}>Contact us using the contact information provided.</li>
          </ul>
          <p style={{ marginBottom: 12 }}>
            Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements.
          </p>
        </section>

        {/* SECTION 10 */}
        <section id="section-10" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>10. CONTROLS FOR DO-NOT-TRACK FEATURES</h2>
          <p style={{ marginBottom: 12 }}>
            Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.
          </p>
        </section>

        {/* SECTION 11 */}
        <section id="section-11" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>11. DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Tennessee, Texas, Utah, or Virginia, you may have the right to request access to and receive details about the personal information we maintain about you and how we have processed it, correct inaccuracies, get a copy of, or delete your personal information.</em></p>
          <p style={{ marginBottom: 12 }}>
            We do not sell personal information. We do not share personal information with third parties for cross-context behavioral advertising or targeted advertising purposes. WildAtlas has not sold or shared personal information at any time in the preceding twelve months.
          </p>
          <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: 8 }}>Categories of Personal Information Collected</h3>
          <p style={{ marginBottom: 12 }}>We have collected the following categories of personal information in the past twelve (12) months:</p>
          <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
            <li style={{ marginBottom: 4 }}>Identifiers (name, email address, phone number)</li>
            <li style={{ marginBottom: 4 }}>Financial information (payment card details via Stripe)</li>
            <li style={{ marginBottom: 4 }}>Internet or similar network activity (app usage, device info)</li>
            <li style={{ marginBottom: 4 }}>Inferences drawn from the above (permit preferences, park interests)</li>
          </ul>
          <p style={{ marginBottom: 12 }}>
            To exercise your rights, contact us at{" "}
            <a href="mailto:wildatlasnp@gmail.com" style={{ color: "#3b82f6" }}>wildatlasnp@gmail.com</a>{" "}
            or submit a request at{" "}
            <a href="https://tally.so/r/XxGJXP" style={{ color: "#3b82f6" }} target="_blank" rel="noopener noreferrer">https://tally.so/r/XxGJXP</a>.
            We will respond to verified requests within 45 days.
          </p>
        </section>

        {/* SECTION 12 */}
        <section id="section-12" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>12. DO WE MAKE UPDATES TO THIS NOTICE?</h2>
          <p style={{ marginBottom: 12 }}><em><strong>In Short:</strong> Yes, we will update this notice as necessary to stay compliant with relevant laws.</em></p>
          <p style={{ marginBottom: 12 }}>
            We may update this Privacy Notice from time to time. The updated version will be indicated by an updated "Last updated" date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.
          </p>
        </section>

        {/* SECTION 13 */}
        <section id="section-13" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>13. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h2>
          <p style={{ marginBottom: 12 }}>If you have questions or comments about this notice, you may email us at{" "}
            <a href="mailto:wildatlasnp@gmail.com" style={{ color: "#3b82f6" }}>wildatlasnp@gmail.com</a>.
          </p>
          <p style={{ marginBottom: 12 }}>
            WildAtlas<br />
            Operated as a sole proprietorship<br />
            United States
          </p>
        </section>

        {/* SECTION 14 */}
        <section id="section-14" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: 12 }}>14. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</h2>
          <p style={{ marginBottom: 12 }}>
            Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please visit:{" "}
            <a href="https://tally.so/r/XxGJXP" style={{ color: "#3b82f6" }} target="_blank" rel="noopener noreferrer">https://tally.so/r/XxGJXP</a>.
          </p>
        </section>

        {/* Attribution */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 16, fontSize: "13px", color: "#9ca3af", textAlign: "center" }}>
          Powered by <a href="https://termly.io" style={{ color: "#3b82f6", textDecoration: "none" }} target="_blank" rel="noopener noreferrer">Termly</a>
        </div>
      </div>
    </div>
  </div>
);

export default TermlyPrivacyPolicy;
