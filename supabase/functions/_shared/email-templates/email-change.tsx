/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email for WildAtlas</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoText}>⛰️ WildAtlas</Text>
        </Section>
        <Heading style={h1}>Confirm your new email</Heading>
        <Text style={text}>
          You requested to change your email from{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>{' '}
          to{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm Email Change →
        </Button>
        <Text style={footer}>
          If you didn't request this, please secure your account immediately.
        </Text>
        <Text style={footerBrand}>
          WildAtlas — Tactical logistics for the modern ranger.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }
const container = { padding: '40px 24px', maxWidth: '520px', margin: '0 auto' }
const headerSection = { marginBottom: '24px' }
const logoText = { fontSize: '20px', fontWeight: 'bold' as const, fontFamily: "Georgia, 'Times New Roman', serif", color: '#2D3B2D', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, fontFamily: "Georgia, 'Times New Roman', serif", color: '#2D3B2D', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#576B57', lineHeight: '1.6', margin: '0 0 24px' }
const link = { color: '#2D5A27', textDecoration: 'underline' }
const button = { backgroundColor: '#2D5A27', color: '#FAF6F1', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '14px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#A09888', margin: '28px 0 0', lineHeight: '1.6' }
const footerBrand = { fontSize: '11px', color: '#C4C0B8', margin: '8px 0 0', fontStyle: 'italic' as const }
