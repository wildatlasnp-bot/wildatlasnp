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
    <Preview>Someone saved you a spot on the trail — WildAtlas</Preview>
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
              <span style={badge}>Invite</span>
            </td>
          </tr>
        </table>
        <Section style={cardInner}>
          <Text style={{ ...eyebrow, textTransform: 'none' as const }}>You're invited</Text>
          <Text style={headline}>
            Someone wants you on the <em style={italicAccent}>trail.</em>
          </Text>
          <Text style={bodyText}>
            You've been invited to join WildAtlas — the permit scanner that watches for openings so you don't have to. Accept below to get started.
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Accept Invitation →
          </Button>

          {/* Tip card */}
          <Section style={tipCard}>
            <Text style={tipLabel}>What's next</Text>
            <Text style={tipText}>
              Once you accept, pick your park and set up a permit watch. We'll do the rest.
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

export default InviteEmail
