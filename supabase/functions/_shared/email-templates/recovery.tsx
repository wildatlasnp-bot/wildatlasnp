/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

import {
  outerBody, card, topBand, cardInner, headline, body,
  ctaButton, footerDivider, footerText, footerTagline,
  fontImport, mountainSvg,
} from './styles.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
    </Head>
    <Preview>Reset your WildAtlas password</Preview>
    <Body style={outerBody}>
      <Container style={card}>
        <Section style={topBand}>
          <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
          <Text style={{ ...headline, fontSize: '18px', margin: '0 0 0 12px', lineHeight: '1' }}>WildAtlas</Text>
        </Section>
        <Section style={cardInner}>
          <Text style={headline}>Reset your password</Text>
          <Text style={body}>
            No worries — even the best rangers lose a trail marker now and then.
            Click below to choose a new password and get back to sniping permits.
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Reset Password →
          </Button>
          <div style={footerDivider} />
          <Text style={footerText}>
            If you didn't request this, your password won't be changed.
            You can safely ignore this email.
          </Text>
          <Text style={footerTagline}>
            WildAtlas — Tactical logistics for the modern ranger.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
