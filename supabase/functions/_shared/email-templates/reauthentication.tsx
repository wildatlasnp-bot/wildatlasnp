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
  outerBody, card, topBand, cardInner, headline, body,
  footerDivider, footerText, footerTagline,
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
        <Section style={topBand}>
          <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
          <Text style={{ ...headline, fontSize: '18px', margin: '0 0 0 12px', lineHeight: '1' }}>WildAtlas</Text>
        </Section>
        <Section style={cardInner}>
          <Text style={headline}>Verification code</Text>
          <Text style={body}>
            Use the code below to confirm your identity. It expires shortly.
          </Text>
          <Text style={{
            fontFamily: "'DM Sans', 'Courier New', monospace",
            fontSize: '28px',
            fontWeight: 500,
            color: '#e8ead4',
            backgroundColor: '#1a2e1e',
            borderRadius: '12px',
            padding: '16px 24px',
            margin: '0 0 28px',
            textAlign: 'center' as const,
            letterSpacing: '4px',
            border: '1px solid #2a3a2f',
          }}>{token}</Text>
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
