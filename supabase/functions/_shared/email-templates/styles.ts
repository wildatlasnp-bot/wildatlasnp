// Shared design system for all WildAtlas auth email templates
// Visual foundation only — no content or variables

export const fontImport = `
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
`;

// Mountain triangle SVG for top band
export const mountainSvg = `<svg width="32" height="24" viewBox="0 0 32 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 2L28 22H4L16 2Z" fill="#2f6f4e"/><path d="M22 8L30 22H14L22 8Z" fill="#1f3a2a" opacity="0.6"/></svg>`;

// ─── Shared style objects ────────────────────────────────────────

export const outerBody: React.CSSProperties = {
  backgroundColor: '#141a15',
  margin: '0',
  padding: '40px 0',
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
};

export const card: React.CSSProperties = {
  backgroundColor: '#1e2e22',
  borderRadius: '16px',
  maxWidth: '520px',
  margin: '0 auto',
  overflow: 'hidden' as const,
};

export const topBand: React.CSSProperties = {
  backgroundColor: '#1a2e1e',
  height: '64px',
  display: 'flex',
  alignItems: 'center',
  paddingLeft: '24px',
  borderBottom: '1px solid #2a3a2f',
};

export const cardInner: React.CSSProperties = {
  padding: '32px',
};

export const headline: React.CSSProperties = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: '28px',
  lineHeight: '1.2',
  color: '#e8ead4',
  margin: '0 0 16px',
  fontWeight: 'normal' as const,
};

export const body: React.CSSProperties = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#8a9e8e',
  margin: '0 0 24px',
};

export const smallText: React.CSSProperties = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#6f8576',
  margin: '0 0 24px',
};

export const ctaButton: React.CSSProperties = {
  backgroundColor: '#2f6f4e',
  color: '#ffffff',
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '14px',
  fontWeight: 500,
  borderRadius: '999px',
  padding: '12px 18px',
  textDecoration: 'none',
  display: 'inline-block',
};

export const pill: React.CSSProperties = {
  backgroundColor: '#1f3a2a',
  color: '#6abf85',
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  padding: '6px 10px',
  borderRadius: '999px',
  display: 'inline-block',
};

export const footerDivider: React.CSSProperties = {
  borderTop: '1px solid #2a3a2f',
  margin: '28px 0 16px',
};

export const footerText: React.CSSProperties = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '12px',
  color: '#6f8576',
  lineHeight: '1.6',
  margin: '0 0 8px',
};

export const footerLink: React.CSSProperties = {
  color: '#4a6a4e',
  textDecoration: 'underline',
};

export const footerTagline: React.CSSProperties = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontStyle: 'italic',
  fontSize: '11px',
  color: '#6f8576',
  margin: '8px 0 0',
};

export const linkInline: React.CSSProperties = {
  color: '#4a6a4e',
  textDecoration: 'underline',
};
