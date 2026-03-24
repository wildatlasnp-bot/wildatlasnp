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
    <Preview>Confirm your email to start watching permits on WildAtlas</Preview>
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
              <span style={badge}>Welcome</span>
            </td>
          </tr>
        </table>
        <Section style={cardInner}>
          <Text style={{ ...eyebrow, textTransform: 'none' as const }}>You're almost there</Text>
          <Text style={headline}>
            Your trail starts <em style={italicAccent}>here.</em>
          </Text>
          <Text style={bodyText}>
            One click and you're in — WildAtlas will start watching for permit openings so you don't have to.
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Confirm Email →
          </Button>

          {/* Tip card */}
          <Section style={tipCard}>
            <Text style={tipLabel}>Ranger tip</Text>
            <Text style={tipText}>
              After confirming, add your first park watch. We'll alert you the moment a permit opens up.
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

export default SignupEmail
