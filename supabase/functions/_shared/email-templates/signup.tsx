/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  outerBody, card, topBand, cardInner, headline, body, smallText,
  ctaButton, pill, footerDivider, footerText, footerLink, footerTagline,
  linkInline, fontImport, mountainSvg,
} from './styles.ts'

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
        <Section style={topBand}>
          <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
          <Text style={{ ...headline, fontSize: '18px', margin: '0 0 0 12px', lineHeight: '1' }}>WildAtlas</Text>
        </Section>
        <Section style={cardInner}>
          <Text style={headline}>Welcome, Ranger!</Text>
          <Text style={body}>
            You're one step away from never refreshing Recreation.gov again.
            Confirm your email to activate your permit sniper.
          </Text>
          <Text style={smallText}>
            Your email:{' '}
            <Link href={`mailto:${recipient}`} style={linkInline}>
              {recipient}
            </Link>
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Get Permit Alerts →
          </Button>
          <Section style={{ backgroundColor: '#1a2e1e', borderRadius: '12px', padding: '16px', marginTop: '24px', marginBottom: '24px', borderLeft: '3px solid #2f6f4e' }}>
            <Text style={{ ...smallText, color: '#8a9e8e', margin: '0' }}>
              🐻 <strong style={{ color: '#e8ead4' }}>Pro tip from Mochi:</strong> Once verified, set up your first watch — Half Dome permits vanish in minutes.
            </Text>
          </Section>
          <div style={footerDivider} />
          <Text style={footerText}>
            If you didn't create an account on{' '}
            <Link href={siteUrl} style={footerLink}>WildAtlas</Link>,
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
