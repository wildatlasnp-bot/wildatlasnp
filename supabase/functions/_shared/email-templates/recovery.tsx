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
  outerBody, card, cardInner, headline, bodyText,
  ctaButton, footerWrap, footerTagline,
  topBandTable, topBandCellLeft, topBandCellBrand, topBandBrandText,
  topBandCellRight, badge, italicAccent,
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
        <table cellPadding="0" cellSpacing="0" style={topBandTable}>
          <tr>
            <td style={topBandCellLeft}>
              <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
            </td>
            <td style={topBandCellBrand}>
              <Text style={topBandBrandText}>WildAtlas</Text>
            </td>
            <td style={topBandCellRight}>
              <span style={badge}>Security</span>
            </td>
          </tr>
        </table>
        <Section style={cardInner}>
          <Text style={headline}>
            Lost on the <em style={italicAccent}>trail?</em>
          </Text>
          <Text style={bodyText}>
            No worries — even the best rangers lose a trail marker now and then. Click below to choose a new password.
          </Text>
          <Button style={ctaButton} href={confirmationUrl}>
            Reset Password →
          </Button>

          {/* Warning box */}
          <Section style={warningBox}>
            <Text style={warningText}>
              If you didn't request this, no changes will be made.
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

export default RecoveryEmail

const warningBox = {
  backgroundColor: '#2a1f1f',
  borderRadius: '8px',
  padding: '14px 16px',
  marginTop: '24px',
}

const warningText = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  color: '#d6a3a3',
  margin: '0',
  lineHeight: '1.6',
}
