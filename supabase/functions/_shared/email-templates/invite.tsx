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
  outerBody, card, cardInner, headline, body,
  ctaButton, pill, footerDivider, footerText, footerTagline,
  topBandOuter, topBandCell,
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
        <table cellPadding="0" cellSpacing="0" width="100%" style={topBandOuter}>
          <tr>
            <td style={topBandCell}>
              <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
            </td>
            <td style={{ ...topBandCell, paddingLeft: '0' }}>
              <Text style={{ ...headline, fontSize: '18px', margin: '0', lineHeight: '1' }}>WildAtlas</Text>
            </td>
            <td style={{ ...topBandCell, textAlign: 'right' as const }}>
              <span style={pill}>Invite</span>
            </td>
          </tr>
        </table>
        <Section style={cardInner}>
          <Text style={headline}>
            Someone wants you on the <em style={{ color: '#6abf85', fontStyle: 'italic' }}>trail.</em>
          </Text>
          <Text style={body}>
            Accept the invitation below to join WildAtlas and start catching permit openings.
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
