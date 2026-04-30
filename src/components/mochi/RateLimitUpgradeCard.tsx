/** Rate limit upgrade card rendered inline in chat when daily question quota is exhausted */
const RateLimitUpgradeCard = ({ onUpgrade }: { onUpgrade: () => void }) => (
  <div
    className="elev-featured elev-poko"
    style={{
      background: '#FFFFFF',
      padding: '16px 18px',
      maxWidth: '85%',
    }}
  >
    {/* RECOMMENDED badge */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: '#FFFFFF', background: '#2F6F4E', borderRadius: 99, padding: '3px 10px',
      }}>Recommended</span>
    </div>
    <img src="/mochi-worried.png" alt="Poko worried" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 10 }} />
    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontStyle: 'italic', fontWeight: 500, color: '#1A2E1F', margin: '0 0 4px', lineHeight: 1.25 }}>
      You've reached your daily limit.
    </p>
    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(28,24,18,0.5)', margin: '0 0 14px', lineHeight: 1.4 }}>
      Pro users get unlimited Poko · 2-min scans · SMS alerts
    </p>
    <button
      onClick={onUpgrade}
      style={{
        width: '100%',
        height: 44,
        borderRadius: 10,
        background: '#2F6F4E',
        color: '#F0EDEA',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
      }}
    >
      Upgrade — $9.99/mo
    </button>
    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(26,24,20,0.35)', textAlign: 'center', marginTop: 8 }}>
      Cancel anytime · 7-day refund
    </p>
  </div>
);

export default RateLimitUpgradeCard;
