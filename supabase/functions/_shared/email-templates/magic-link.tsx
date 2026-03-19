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
  outerBody, card, cardInner, headline, body, smallText,
  ctaButton, pill, footerDivider, footerTagline,
  topBandOuter, topBandCell,
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
        <table cellPadding="0" cellSpacing="0" width="100%" style={topBandOuter}>
          <tr>
            <td style={topBandCell}>
              <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
            </td>
            <td style={{ ...topBandCell, paddingLeft: '0' }}>
              <Text style={{ ...headline, fontSize: '18px', margin: '0', lineHeight: '1' }}>WildAtlas</Text>
            </td>
            <td style={{ ...topBandCell, textAlign: 'right' as const }}>
              <span style={pill}>Sign in</span>
            </td>
          </tr>
        </table>
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
