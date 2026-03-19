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
  outerBody, card, topBand, cardInner, headline, body, smallText,
  ctaButton, pill, footerDivider, footerText, footerTagline,
  fontImport, mountainSvg,
} from './styles.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
    </Head>
    <Preview>Your WildAtlas login link</Preview>
    <Body style={outerBody}>
      <Container style={card}>
        <Section style={topBand}>
          <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
          <Text style={{ ...headline, fontSize: '18px', margin: '0 0 0 12px', lineHeight: '1', flex: '1' }}>WildAtlas</Text>
          <Text style={{ ...pill, margin: '0 24px 0 0' }}>Sign in</Text>
        </Section>
        <Section style={cardInner}>
          <Text style={headline}>
            Your login link is <em style={{ color: '#6abf85', fontStyle: 'italic' }}>ready.</em>
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Sign In →
          </Button>
          <Text style={{ ...smallText, marginTop: '24px' }}>
            This link expires shortly. If you didn't request it, you can safely ignore this email.
          </Text>

          <div style={footerDivider} />
          <Text style={footerTagline}>
            WildAtlas — Tactical logistics for the modern ranger.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
