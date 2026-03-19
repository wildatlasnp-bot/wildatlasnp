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
  outerBody, card, cardInner, headline, bodyText,
  ctaButton, pill, tipCard, tipLabel, tipText,
  footerWrap, footerText, footerTagline,
  topBandTable, topBandCellLeft, topBandCellBrand, topBandBrandText,
  topBandCellRight, badge, italicAccent, eyebrow,
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
        <table cellPadding="0" cellSpacing="0" style={topBandTable}>
          <tr>
            <td style={topBandCellLeft}>
              <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
            </td>
            <td style={topBandCellBrand}>
              <Text style={topBandBrandText}>WildAtlas</Text>
            </td>
            <td style={topBandCellRight}>
              <span style={badge}>New account</span>
            </td>
          </tr>
        </table>

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
          <Text style={eyebrow}>You're almost in</Text>
          <Text style={headline}>
            Welcome, <em style={italicAccent}>Ranger.</em>
          </Text>
          <Text style={bodyText}>
            You're one step away from never checking Recreation.gov again. Confirm your email to activate your alerts.
          </Text>

          {/* Email pill */}
          <table cellPadding="0" cellSpacing="0" style={{ marginBottom: '24px' }}>
            <tr>
              <td>
                <span style={pill}>{recipient}</span>
              </td>
            </tr>
          </table>

          {/* CTA */}
          <Button style={ctaButton} href={confirmationUrl}>
            Get Permit Alerts →
          </Button>

          {/* ── 3-step row ── */}
          <Section style={{ margin: '28px 0 24px', textAlign: 'center' as const }}>
            <table cellPadding="0" cellSpacing="0" style={{ width: '100%' }}>
              <tr>
                <td style={stepCell}>
                  <table cellPadding="0" cellSpacing="0" style={{ margin: '0 auto' }}>
                    <tr>
                      <td style={stepCircle}>
                        <Text style={stepNumber}>1</Text>
                      </td>
                    </tr>
                  </table>
                  <Text style={stepLabel}>Confirm email</Text>
                </td>
                <td style={stepArrowCell}>
                  <Text style={stepArrow}>→</Text>
                </td>
                <td style={stepCell}>
                  <table cellPadding="0" cellSpacing="0" style={{ margin: '0 auto' }}>
                    <tr>
                      <td style={stepCircle}>
                        <Text style={stepNumber}>2</Text>
                      </td>
                    </tr>
                  </table>
                  <Text style={stepLabel}>Add permit alert</Text>
                </td>
                <td style={stepArrowCell}>
                  <Text style={stepArrow}>→</Text>
                </td>
                <td style={stepCell}>
                  <table cellPadding="0" cellSpacing="0" style={{ margin: '0 auto' }}>
                    <tr>
                      <td style={stepCircle}>
                        <Text style={stepNumber}>3</Text>
                      </td>
                    </tr>
                  </table>
                  <Text style={stepLabel}>Get notified instantly</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* ── Tip card ── */}
          <Section style={tipCard}>
            <Text style={tipLabel}>Ranger note</Text>
            <Text style={tipText}>
              Half Dome permits vanish in minutes — set your first alert right away.
            </Text>
          </Section>
        </Section>

        {/* ── Footer ── */}
        <Section style={footerWrap}>
          <Text style={safetyNote}>
            If you didn't create an account on WildAtlas, you can safely ignore this email.
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

const stepCircle = {
  backgroundColor: '#eaf3de',
  border: '1.5px solid #97c459',
  borderRadius: '50%',
  width: '32px',
  height: '32px',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}

const stepNumber = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '14px',
  fontWeight: 600,
  color: '#3b6d11',
  margin: '0',
  lineHeight: '32px',
}

const stepLabel = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '11px',
  color: '#5a6a5a',
  margin: '6px 0 0',
  lineHeight: '1.3',
}

const stepArrowCell = {
  textAlign: 'center' as const,
  verticalAlign: 'top' as const,
  width: '5%',
  paddingTop: '6px',
}

const stepArrow = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '16px',
  color: '#c0dd97',
  margin: '0',
  lineHeight: '32px',
}

const safetyNote = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  color: '#9aaa8a',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
