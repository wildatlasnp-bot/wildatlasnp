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
  outerBody, card, cardInner, headline, bodyText, eyebrow,
  ctaButton, footerWrap, footerTagline, italicAccent,
  topBandTable, topBandCellLeft, topBandCellBrand, topBandBrandText,
  topBandCellRight, badge,
  tipCard, tipLabel, tipText,
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
    <Preview>Your WildAtlas login link is ready</Preview>
    <Body style={outerBody}>
      <Container style={card}>
        <table cellPadding="0" cellSpacing="0" style={topBandTable}>
          <tr>
            <td style={topBandCellLeft}>
              <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
            </td>
            <td style={topBandCellBrand}>
              <Text style={topBandBrandText}>WildAtlas</Text>
            </td>
            <td style={topBandCellRight}>
              <span style={badge}>Login</span>
            </td>
          </tr>
        </table>
        <Section style={cardInner}>
          <Text style={{ ...eyebrow, textTransform: 'none' as const }}>Magic link</Text>
          <Text style={headline}>
            Your login link is <em style={italicAccent}>ready.</em>
          </Text>
          <Text style={bodyText}>
            Click below to sign in to WildAtlas. This link expires shortly, so don't leave it on the trail too long.
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Log In →
          </Button>

          {/* Tip card */}
          <Section style={tipCard}>
            <Text style={tipLabel}>Heads up</Text>
            <Text style={tipText}>
              This link can only be used once. If it expires, request a new one from the login page.
            </Text>
          </Section>
        </Section>

        {/* ── Footer ── */}
        <Section style={footerWrap}>
          <Text style={footerTagline}>
            WildAtlas — Tactical logistics for the modern ranger.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
