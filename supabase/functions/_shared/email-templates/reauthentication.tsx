/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  outerBody, card, cardInner, headline, bodyText, eyebrow,
  footerWrap, footerTagline, italicAccent,
  topBandTable, topBandCellLeft, topBandCellBrand, topBandBrandText,
  topBandCellRight, badge,
  fontImport, mountainSvg,
} from './styles.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
    </Head>
    <Preview>Your WildAtlas verification code</Preview>
    <Body style={outerBody}>
      <Container style={card}>
        <table cellPadding="0" cellSpacing="0" style={topBandTable}>
          <tr>
            <td style={topBandCellLeft}>
              <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
            </td>
            <td style={topBandCellBrand}>
              <Text style={topBandBrandText}>WildAtlas</Text>
            </td>
            <td style={topBandCellRight}>
              <span style={badge}>Verification</span>
            </td>
          </tr>
        </table>
        <Section style={cardInner}>
          <Text style={eyebrow}>One-time code</Text>
          <Text style={headline}>
            Your verification <em style={italicAccent}>code.</em>
          </Text>
          <Text style={bodyText}>
            Use the code below to confirm your identity.
          </Text>

          {/* OTP block */}
          <table cellPadding="0" cellSpacing="0" width="100%" style={{ marginBottom: '8px' }}>
            <tr>
              <td style={otpBlock}>
                <Text style={otpCode}>{token}</Text>
              </td>
            </tr>
          </table>

          <Text style={expiryText}>
            Expires in 10 minutes.
          </Text>
        </Section>

        {/* ── Footer ── */}
        <Section style={footerWrap}>
          <Text style={safetyNote}>
            If you didn't request this, you can safely ignore this email.
          </Text>
          <Text style={footerTagline}>
            WildAtlas — Tactical logistics for the modern ranger.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const otpBlock = {
  backgroundColor: '#f7faf4',
  border: '1px solid #c0dd97',
  borderRadius: '10px',
  padding: '24px',
  textAlign: 'center' as const,
}

const otpCode = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: '44px',
  color: '#1a2e1e',
  letterSpacing: '0.2em',
  margin: '0',
  lineHeight: '1.2',
}

const expiryText = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '12px',
  color: '#8a9a8a',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}

const safetyNote = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  color: '#9aaa8a',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
