/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your WildAtlas login link</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoText}>⛰️ WildAtlas</Text>
        </Section>
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>
          Click below to sign in to WildAtlas. This link expires shortly — just like a good permit.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Sign In →
        </Button>
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
        <Text style={footerBrand}>
          WildAtlas — Tactical logistics for the modern ranger.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }
const container = { padding: '40px 24px', maxWidth: '520px', margin: '0 auto' }
const headerSection = { marginBottom: '24px' }
const logoText = { fontSize: '20px', fontWeight: 'bold' as const, fontFamily: "Georgia, 'Times New Roman', serif", color: '#2D3B2D', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, fontFamily: "Georgia, 'Times New Roman', serif", color: '#2D3B2D', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#576B57', lineHeight: '1.6', margin: '0 0 24px' }
const button = { backgroundColor: '#2D5A27', color: '#FAF6F1', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '14px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#A09888', margin: '28px 0 0', lineHeight: '1.6' }
const footerBrand = { fontSize: '11px', color: '#C4C0B8', margin: '8px 0 0', fontStyle: 'italic' as const }
