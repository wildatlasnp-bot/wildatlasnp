// Shared design system for all WildAtlas auth email templates
// Visual foundation — light theme, DM Sans + DM Serif Display

export const fontImport = `
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
`;

// Mountain triangle SVG — outer #6abf85, inner #2f6f4e, dot #a8d4b8
export const mountainSvg = `<svg width="28" height="22" viewBox="0 0 28 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 1L26 21H2L14 1Z" fill="#6abf85"/><path d="M14 6L21 19H7L14 6Z" fill="#2f6f4e"/><circle cx="14" cy="10" r="1.5" fill="#a8d4b8"/></svg>`;

// ─── Layout ──────────────────────────────────────────────────────

export const outerBody = {
  backgroundColor: '#f0ede6',
  margin: '0',
  padding: '40px 0',
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
};

export const card = {
  backgroundColor: '#ffffff',
  border: '1px solid #e4e0d8',
  borderRadius: '12px',
  maxWidth: '520px',
  margin: '0 auto',
  overflow: 'hidden' as const,
};

// ─── Top band ────────────────────────────────────────────────────

export const topBandTable = {
  backgroundColor: '#1e3a28',
  width: '100%',
  height: '60px',
};

export const topBandCellLeft = {
  padding: '0 0 0 28px',
  verticalAlign: 'middle' as const,
  width: '28px',
};

export const topBandCellBrand = {
  padding: '0 0 0 10px',
  verticalAlign: 'middle' as const,
};

export const topBandBrandText = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: '17px',
  color: '#f0ede6',
  margin: '0',
  lineHeight: '1',
};

export const topBandCellRight = {
  padding: '0 28px 0 0',
  verticalAlign: 'middle' as const,
  textAlign: 'right' as const,
};

export const badge = {
  border: '1px solid #3a6a4e',
  color: '#a8d4b8',
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  borderRadius: '20px',
  padding: '3px 10px',
  display: 'inline-block',
};

// ─── Body ────────────────────────────────────────────────────────

export const cardInner = {
  padding: '36px 36px 0',
};

export const eyebrow = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#3b6d11',
  margin: '0 0 8px',
};

export const headline = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontSize: '30px',
  lineHeight: '1.15',
  color: '#1a2e1e',
  margin: '0 0 16px',
  fontWeight: 'normal' as const,
};

export const italicAccent = {
  color: '#2f6f4e',
  fontStyle: 'italic' as const,
};

export const bodyText = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '15px',
  lineHeight: '1.65',
  color: '#5a6a5a',
  margin: '0 0 24px',
};

export const smallText = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  lineHeight: '1.5',
  color: '#5a6a5a',
  margin: '0 0 24px',
};

// ─── CTA ─────────────────────────────────────────────────────────

export const ctaButton = {
  backgroundColor: '#2f6f4e',
  color: '#ffffff',
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '14px',
  fontWeight: 600,
  borderRadius: '999px',
  padding: '13px 28px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
};

// ─── Pills ───────────────────────────────────────────────────────

export const pill = {
  backgroundColor: '#eaf3de',
  border: '1px solid #c0dd97',
  color: '#3b6d11',
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  fontWeight: 500,
  padding: '5px 12px',
  borderRadius: '999px',
  display: 'inline-block',
};

export const pillLabel = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '10px',
  fontWeight: 600,
  color: '#3b6d11',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
};

// ─── Tip card ────────────────────────────────────────────────────

export const tipCard = {
  backgroundColor: '#f7faf4',
  border: '1px solid #c0dd97',
  borderLeft: '3px solid #2f6f4e',
  borderRadius: '8px',
  padding: '14px 16px',
  marginTop: '24px',
  marginBottom: '4px',
};

export const tipLabel = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: '#3b6d11',
  margin: '0 0 4px',
};

export const tipText = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '13px',
  color: '#5a7a5a',
  margin: '0',
  lineHeight: '1.6',
};

// ─── Footer ──────────────────────────────────────────────────────

export const footerWrap = {
  borderTop: '1px solid #eae6de',
  padding: '20px 36px 28px',
};

export const footerText = {
  fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  fontSize: '12px',
  color: '#8a9a7a',
  lineHeight: '1.6',
  margin: '0 0 8px',
};

export const footerLink = {
  color: '#8a9a7a',
  textDecoration: 'underline',
};

export const footerTagline = {
  fontFamily: "'DM Serif Display', Georgia, serif",
  fontStyle: 'italic' as const,
  fontSize: '12px',
  color: '#9aaa8a',
  margin: '8px 0 0',
};
