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
        <Section style={topBand}>
          <span dangerouslySetInnerHTML={{ __html: mountainSvg }} />
          <Text style={{ ...headline, fontSize: '18px', margin: '0 0 0 12px', lineHeight: '1', flex: '1' }}>WildAtlas</Text>
          <Text style={{ ...pill, margin: '0 24px 0 0' }}>Security</Text>
        </Section>
        <Section style={cardInner}>
          <Text style={headline}>
            Confirm your <em style={{ color: '#6abf85', fontStyle: 'italic' }}>new</em> email.
          </Text>
          <Text style={body}>
            You requested to change your email address. Please confirm below.
          </Text>

          {/* Email pills with labels */}
          <table cellPadding="0" cellSpacing="0" style={{ width: '100%', marginBottom: '24px' }}>
            <tr>
              <td style={{ width: '48%' }}>
                <Text style={pillLabel}>Current email</Text>
                <Text style={{ ...pill, display: 'inline-block' }}>{email}</Text>
              </td>
              <td style={{ width: '4%', textAlign: 'center' as const, verticalAlign: 'bottom' as const, paddingBottom: '8px' }}>
                <Text style={{ color: '#2a3a2f', fontSize: '16px', margin: '0' }}>→</Text>
              </td>
              <td style={{ width: '48%' }}>
                <Text style={pillLabel}>New email</Text>
                <Text style={{ ...pill, display: 'inline-block' }}>{newEmail}</Text>
              </td>
            </tr>
          </table>

          <Button style={ctaButton} href={confirmationUrl}>
            Confirm Email Change →
          </Button>

          <div style={footerDivider} />
          <Text style={footerText}>
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

const pillLabel = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '11px',
  color: '#6f8576',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}
