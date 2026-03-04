/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your WildAtlas verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoText}>⛰️ WildAtlas</Text>
        </Section>
        <Heading style={h1}>Verification code</Heading>
        <Text style={text}>
          Use the code below to confirm your identity. It expires shortly.
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          If you didn't request this, you can safely ignore this email.
        </Text>
        <Text style={footerBrand}>
          WildAtlas — Tactical logistics for the modern ranger.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }
const container = { padding: '40px 24px', maxWidth: '520px', margin: '0 auto' }
const headerSection = { marginBottom: '24px' }
const logoText = { fontSize: '20px', fontWeight: 'bold' as const, fontFamily: "Georgia, 'Times New Roman', serif", color: '#2D3B2D', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, fontFamily: "Georgia, 'Times New Roman', serif", color: '#2D3B2D', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#576B57', lineHeight: '1.6', margin: '0 0 24px' }
const codeStyle = { fontFamily: "'Courier New', Courier, monospace", fontSize: '28px', fontWeight: 'bold' as const, color: '#2D3B2D', backgroundColor: '#FAF6F1', borderRadius: '12px', padding: '16px 24px', margin: '0 0 28px', textAlign: 'center' as const, letterSpacing: '4px', border: '1px solid #E8E0D5' }
const footer = { fontSize: '12px', color: '#A09888', margin: '28px 0 0', lineHeight: '1.6' }
const footerBrand = { fontSize: '11px', color: '#C4C0B8', margin: '8px 0 0', fontStyle: 'italic' as const }
