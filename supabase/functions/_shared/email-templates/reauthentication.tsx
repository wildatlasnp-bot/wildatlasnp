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
  outerBody, card, cardInner, headline, body, smallText,
  pill, footerDivider, footerText, footerTagline,
  topBandOuter, topBandCell,
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
        <table cellPadding="0" cellSpacing="0" width="100%" style={topBandOuter}>
          <tr>
            <td style={topBandCell}>
              <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
            </td>
            <td style={{ ...topBandCell, paddingLeft: '0' }}>
              <Text style={{ ...headline, fontSize: '18px', margin: '0', lineHeight: '1' }}>WildAtlas</Text>
            </td>
            <td style={{ ...topBandCell, textAlign: 'right' as const }}>
              <span style={pill}>Verification</span>
            </td>
          </tr>
        </table>
        <Section style={cardInner}>
          <Text style={headline}>
            Your verification <em style={{ color: '#6abf85', fontStyle: 'italic' }}>code.</em>
          </Text>
          <Text style={body}>
            Use the code below to confirm your identity.
          </Text>

          {/* OTP block */}
          <table cellPadding="0" cellSpacing="0" width="100%" style={{ marginBottom: '12px' }}>
            <tr>
              <td style={otpBlock}>
                <Text style={otpCode}>{token}</Text>
              </td>
            </tr>
          </table>

          <Text style={{ ...smallText, textAlign: 'center' as const, margin: '0 0 24px' }}>
            Expires in 10 minutes.
          </Text>

          <div style={footerDivider} />
          <Text style={footerText}>
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
  backgroundColor: '#18261d',
  borderRadius: '12px',
  padding: '16px',
  textAlign: 'center' as const,
}

const otpCode = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: '40px',
  color: '#e8ead4',
  letterSpacing: '0.2em',
  margin: '0',
  lineHeight: '1.2',
}
