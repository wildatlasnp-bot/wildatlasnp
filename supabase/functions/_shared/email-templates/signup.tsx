/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  outerBody, card, topBand, cardInner, headline, body, smallText,
  ctaButton, pill, footerDivider, footerText, footerTagline,
  fontImport, mountainSvg,
} from './styles.ts'

const MOCHI_URL = 'https://mnhofrfaqnihaosvaaqa.supabase.co/storage/v1/object/public/email-assets/mochi-wave.png'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
    </Head>
    <Preview>Welcome to WildAtlas — confirm your email to start sniping permits</Preview>
    <Body style={outerBody}>
      <Container style={card}>
        {/* ── Top band ── */}
        <Section style={topBand}>
          <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
          <Text style={{ ...headline, fontSize: '18px', margin: '0 0 0 12px', lineHeight: '1', flex: '1' }}>WildAtlas</Text>
          <Text style={{ ...pill, margin: '0 24px 0 0' }}>New account</Text>
        </Section>

        {/* ── Mochi hero ── */}
        <Section style={{ textAlign: 'center' as const, padding: '28px 0 0' }}>
          <Img
            src={MOCHI_URL}
            alt="Mochi the bear waving"
            width="180"
            style={{ maxWidth: '180px', margin: '0 auto', display: 'block' }}
          />
        </Section>

        {/* ── Content ── */}
        <Section style={cardInner}>
          <Text style={headline}>
            Welcome, <em style={{ color: '#6abf85', fontStyle: 'italic' }}>Ranger.</em>
          </Text>
          <Text style={body}>
            You're one step away from never checking Recreation.gov again. Confirm your email to activate your alerts.
          </Text>

          {/* Email pill */}
          <Text style={{ ...pill, margin: '0 0 24px' }}>
            {recipient}
          </Text>

          {/* CTA */}
          <Button style={ctaButton} href={confirmationUrl}>
            Get Permit Alerts →
          </Button>

          {/* ── 3-step row ── */}
          <Section style={{ margin: '28px 0', textAlign: 'center' as const }}>
            <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
              <tr>
                <td style={stepCell}>
                  <Text style={stepNumber}>1</Text>
                  <Text style={stepLabel}>Confirm email</Text>
                </td>
                <td style={stepArrow}>→</td>
                <td style={stepCell}>
                  <Text style={stepNumber}>2</Text>
                  <Text style={stepLabel}>Add permit alert</Text>
                </td>
                <td style={stepArrow}>→</td>
                <td style={stepCell}>
                  <Text style={stepNumber}>3</Text>
                  <Text style={stepLabel}>Get notified instantly</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* ── Tip card ── */}
          <Section style={tipCard}>
            <Text style={tipText}>
              🐻 <strong style={{ color: '#e8ead4' }}>Ranger note:</strong> Half Dome permits vanish in minutes — set your first alert right away.
            </Text>
          </Section>

          {/* ── Footer ── */}
          <div style={footerDivider} />
          <Text style={footerText}>
            If you didn't create an account on{' '}
            <Link href={siteUrl} style={{ color: '#4a6a4e', textDecoration: 'underline' }}>WildAtlas</Link>,
            you can safely ignore this email.
          </Text>
          <Text style={footerTagline}>
            WildAtlas — Tactical logistics for the modern ranger.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

// ─── Local styles ────────────────────────────────────────────────

const stepCell = {
  textAlign: 'center' as const,
  verticalAlign: 'top' as const,
  width: '30%',
}

const stepNumber = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '20px',
  fontWeight: 500,
  color: '#6abf85',
  margin: '0 0 4px',
  lineHeight: '1',
}

const stepLabel = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '12px',
  color: '#6f8576',
  margin: '0',
  lineHeight: '1.3',
}

const stepArrow = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '16px',
  color: '#2a3a2f',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  width: '5%',
}

const tipCard = {
  backgroundColor: '#18261d',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '4px',
  borderLeft: '3px solid #2f6f4e',
}

const tipText = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  color: '#8a9e8e',
  margin: '0',
  lineHeight: '1.5',
}
