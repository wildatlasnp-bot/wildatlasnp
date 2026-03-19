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
          <Text style={eyebrow}>You're invited</Text>
          <Text style={headline}>
            Someone wants you on the <em style={italicAccent}>trail.</em>
          </Text>
          <Text style={bodyText}>
            Accept the invitation below to join WildAtlas and start catching permit openings before they're gone.
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Accept Invitation →
          </Button>
        </Section>

        {/* ── Footer ── */}
        <Section style={footerWrap}>
          <Text style={safetyNote}>
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

const safetyNote = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  color: '#9aaa8a',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
