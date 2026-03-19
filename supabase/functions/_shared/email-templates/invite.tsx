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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
    </Head>
    <Preview>You've been invited to WildAtlas</Preview>
    <Body style={outerBody}>
      <Container style={card}>
        <Section style={topBand}>
          <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
          <Text style={{ ...headline, fontSize: '18px', margin: '0 0 0 12px', lineHeight: '1' }}>WildAtlas</Text>
        </Section>
        <Section style={cardInner}>
          <Text style={headline}>You've been invited!</Text>
          <Text style={body}>
            Someone wants you on the trail. Accept the invitation below to join WildAtlas and start sniping permits.
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Accept Invitation →
          </Button>
          <div style={footerDivider} />
          <Text style={footerText}>
            If you weren't expecting this, you can safely ignore this email.
          </Text>
          <Text style={footerTagline}>
            WildAtlas — Tactical logistics for the modern ranger.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
