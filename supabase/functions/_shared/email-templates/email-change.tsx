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
  ctaButton, pill, pillLabel, footerWrap, footerTagline, italicAccent,
  topBandTable, topBandCellLeft, topBandCellBrand, topBandBrandText,
  topBandCellRight, badge,
  fontImport, mountainSvg,
} from './styles.ts'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style dangerouslySetInnerHTML={{ __html: fontImport }} />
    </Head>
    <Preview>Confirm your new email for WildAtlas</Preview>
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
          <Text style={eyebrow}>Email change</Text>
          <Text style={headline}>
            Confirm your <em style={italicAccent}>new</em> email.
          </Text>
          <Text style={bodyText}>
            You requested to change your email address. Please confirm below.
          </Text>

          {/* Email pills with labels */}
          <table cellPadding="0" cellSpacing="0" style={{ width: '100%', marginBottom: '24px' }}>
            <tr>
              <td style={{ width: '46%' }}>
                <Text style={pillLabel}>Current email</Text>
                <span style={pill}>{email}</span>
              </td>
              <td style={{ width: '8%', textAlign: 'center' as const, verticalAlign: 'bottom' as const, paddingBottom: '6px' }}>
                <Text style={{ color: '#2f6f4e', fontSize: '16px', margin: '0' }}>→</Text>
              </td>
              <td style={{ width: '46%' }}>
                <Text style={pillLabel}>New email</Text>
                <span style={pill}>{newEmail}</span>
              </td>
            </tr>
          </table>

          <Button style={ctaButton} href={confirmationUrl}>
            Confirm Email Change →
          </Button>
        </Section>

        {/* ── Footer ── */}
        <Section style={footerWrap}>
          <Text style={warningNote}>
            If you didn't request this, please secure your account immediately.
          </Text>
          <Text style={footerTagline}>
            WildAtlas — Tactical logistics for the modern ranger.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const warningNote = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  color: '#c07a7a',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
