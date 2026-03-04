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
    <Head />
    <Preview>Welcome to WildAtlas — confirm your email to start sniping permits</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={logoText}>⛰️ WildAtlas</Text>
        </Section>
        <Heading style={h1}>Welcome, Ranger!</Heading>
        <Text style={text}>
          You're one step away from never refreshing Recreation.gov again.
          Confirm your email to activate your permit sniper.
        </Text>
        <Text style={textSmall}>
          Your email:{' '}
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
        </Text>
        <Button style={button} href={confirmationUrl}>
          Get Permit Alerts →
        </Button>
        <Section style={tipBox}>
          <Text style={tipText}>
            🐻 <strong>Pro tip from Mochi:</strong> Once verified, set up your first watch — Half Dome permits vanish in minutes.
          </Text>
        </Section>
        <Text style={footer}>
          If you didn't create an account on{' '}
          <Link href={siteUrl} style={footerLink}>WildAtlas</Link>,
          you can safely ignore this email.
        </Text>
        <Text style={footerBrand}>
          WildAtlas — Tactical logistics for the modern ranger.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }
const container = { padding: '40px 24px', maxWidth: '520px', margin: '0 auto' }
const headerSection = { marginBottom: '24px' }
const logoText = { fontSize: '20px', fontWeight: 'bold' as const, fontFamily: "Georgia, 'Times New Roman', serif", color: '#2D3B2D', margin: '0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, fontFamily: "Georgia, 'Times New Roman', serif", color: '#2D3B2D', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#576B57', lineHeight: '1.6', margin: '0 0 20px' }
const textSmall = { fontSize: '13px', color: '#8B7D6B', lineHeight: '1.5', margin: '0 0 24px' }
const link = { color: '#2D5A27', textDecoration: 'underline' }
const button = { backgroundColor: '#2D5A27', color: '#FAF6F1', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '14px', padding: '14px 28px', textDecoration: 'none' }
const tipBox = { backgroundColor: '#FAF6F1', borderRadius: '12px', padding: '16px', marginTop: '24px', marginBottom: '24px', borderLeft: '3px solid #C4714E' }
const tipText = { fontSize: '13px', color: '#6B5D4D', margin: '0', lineHeight: '1.5' }
const footer = { fontSize: '12px', color: '#A09888', margin: '28px 0 0', lineHeight: '1.6' }
const footerLink = { color: '#A09888', textDecoration: 'underline' }
const footerBrand = { fontSize: '11px', color: '#C4C0B8', margin: '8px 0 0', fontStyle: 'italic' as const }
