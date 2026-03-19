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
  outerBody, card, topBand, cardInner, headline, body,
  ctaButton, footerDivider, footerText, footerTagline,
  linkInline, fontImport, mountainSvg,
} from './styles.ts'

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
    <Head>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
    </Head>
    <Preview>Confirm your new email for WildAtlas</Preview>
    <Body style={outerBody}>
      <Container style={card}>
        <Section style={topBand}>
          <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
          <Text style={{ ...headline, fontSize: '18px', margin: '0 0 0 12px', lineHeight: '1' }}>WildAtlas</Text>
        </Section>
        <Section style={cardInner}>
          <Text style={headline}>Confirm your new email</Text>
          <Text style={body}>
            You requested to change your email from{' '}
            <Link href={`mailto:${email}`} style={linkInline}>{email}</Link>{' '}
            to{' '}
            <Link href={`mailto:${newEmail}`} style={linkInline}>{newEmail}</Link>.
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Confirm Email Change →
          </Button>
          <div style={footerDivider} />
          <Text style={footerText}>
            If you didn't request this, please secure your account immediately.
          </Text>
          <Text style={footerTagline}>
            WildAtlas — Tactical logistics for the modern ranger.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
