import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_EMAIL_HTML = `
<div style="background-color:#FAF6F1;padding:16px 8px;font-family:Georgia,'Times New Roman',serif;color:#2D3B2D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;">
    <!-- HEADER -->
    <tr><td style="background:linear-gradient(135deg, #2D3B2D 0%, #4A5D4A 100%);border-radius:14px 14px 0 0;padding:28px 20px 22px;text-align:center;">
      <div style="font-size:36px;line-height:1;margin-bottom:8px;">🎯</div>
      <div style="font-size:20px;font-weight:700;color:#FAF6F1;font-family:Georgia,'Times New Roman',serif;margin-bottom:3px;">Availability Detected</div>
      <div style="font-size:11px;color:#C4956A;font-family:-apple-system,sans-serif;letter-spacing:0.5px;">WildAtlas detected a permit opening</div>
    </td></tr>
    <!-- BODY -->
    <tr><td style="background-color:#FFFFFF;padding:24px 20px 18px;">
      <!-- Permit Card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6F1;border:2px solid #C4956A;border-radius:12px;margin-bottom:18px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:17px;font-weight:700;color:#C4956A;font-family:Georgia,serif;margin-bottom:3px;">Half Dome Day Hike</div>
          <div style="font-size:11px;color:#6B5D4D;text-transform:uppercase;letter-spacing:1px;font-weight:600;font-family:-apple-system,sans-serif;">Yosemite National Park</div>
        </td></tr>
      </table>
      <!-- Dates header -->
      <div style="font-size:9px;font-weight:700;color:#A09888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:-apple-system,sans-serif;">Available Dates</div>
      <!-- Pattern banner -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F0;border-left:3px solid #E8A84C;border-radius:6px;margin-bottom:10px;">
        <tr><td style="padding:8px 12px;font-size:10px;color:#8B7D6B;font-family:-apple-system,sans-serif;line-height:1.4;">
          <strong style="color:#B8860B;">Pattern detected:</strong> multiple dates opened together.
        </td></tr>
      </table>
      <!-- Date table -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E8E0D5;border-radius:8px;margin-bottom:18px;">
        <tr>
          <td style="padding:7px 10px;font-size:12px;color:#2D3B2D;font-family:-apple-system,sans-serif;border-bottom:1px solid #E8E0D5;">
            <span style="font-weight:600;">Wed</span>, Jul 15, 2026
          </td>
          <td style="padding:7px 10px;text-align:right;border-bottom:1px solid #E8E0D5;">
            <span style="background:#FFF3E0;color:#B8860B;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">3 spots — limited</span>
          </td>
        </tr>
        <tr>
          <td style="padding:7px 10px;font-size:12px;color:#2D3B2D;font-family:-apple-system,sans-serif;border-bottom:1px solid #E8E0D5;">
            <span style="font-weight:600;">Thu</span>, Jul 16, 2026
          </td>
          <td style="padding:7px 10px;text-align:right;border-bottom:1px solid #E8E0D5;">
            <span style="background:#FDE8E8;color:#B91C1C;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">1 spot left</span>
          </td>
        </tr>
        <tr>
          <td style="padding:7px 10px;font-size:12px;color:#2D3B2D;font-family:-apple-system,sans-serif;">
            <span style="font-weight:600;">Fri</span>, Jul 17, 2026
          </td>
          <td style="padding:7px 10px;text-align:right;">
            <span style="background:#E8F4E8;color:#4A5D4A;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;">5 spots</span>
          </td>
        </tr>
      </table>
      <!-- CTA -->
      <div style="text-align:center;margin-bottom:6px;">
        <span style="display:inline-block;background:#C4956A;color:#FFFFFF;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;font-family:-apple-system,sans-serif;">Claim on Recreation.gov →</span>
      </div>
      <div style="text-align:center;font-size:9px;color:#A09888;font-family:-apple-system,sans-serif;margin-bottom:18px;">Opens directly to the permit page on Recreation.gov</div>
      <!-- Urgency -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F0;border-left:4px solid #E8A84C;border-radius:8px;margin-bottom:18px;">
        <tr><td style="padding:10px 14px;">
          <div style="font-size:12px;font-weight:700;color:#B8860B;font-family:-apple-system,sans-serif;margin-bottom:2px;">⏰ Act Fast</div>
          <div style="font-size:10px;color:#8B7D6B;font-family:-apple-system,sans-serif;line-height:1.5;">Cancellation permits typically get claimed within minutes.</div>
        </td></tr>
      </table>
    </td></tr>
    <!-- FOOTER -->
    <tr><td style="background-color:#FFFFFF;border-radius:0 0 14px 14px;padding:14px 20px 20px;border-top:1px solid #E8E0D5;">
      <div style="text-align:center;font-size:9px;color:#A09888;line-height:1.8;font-family:-apple-system,sans-serif;">
        WildAtlas · Open App · Manage Watches · Privacy · Terms
      </div>
      <div style="text-align:center;font-size:8px;color:#C0B8A8;line-height:1.6;margin-top:8px;font-family:-apple-system,sans-serif;">
        You're receiving this because you have an active watch on WildAtlas.
      </div>
    </td></tr>
  </table>
</div>
`;

const EmailPreviewModal = ({ open, onOpenChange }: EmailPreviewModalProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(true);
  const [canScrollUp, setCanScrollUp] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 8);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }, []);

  useEffect(() => {
    if (open) {
      // Re-check after modal renders
      requestAnimationFrame(checkScroll);
    }
  }, [open, checkScroll]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] rounded-2xl p-0 overflow-hidden gap-0 max-h-[85vh] animate-fade-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/50 bg-card pr-12">
          <p className="text-[14px] font-heading font-bold text-foreground">Email Preview</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">What your permit alerts look like</p>
        </div>

        {/* Email render with scroll shadows */}
        <div className="relative">
          {/* Top fade */}
          <div
            className="absolute top-0 left-0 right-0 h-6 z-10 pointer-events-none transition-opacity duration-300"
            style={{
              opacity: canScrollUp ? 1 : 0,
              background: "linear-gradient(to bottom, hsl(var(--background) / 0.9), transparent)",
            }}
          />
          <div
            ref={scrollRef}
            className="overflow-y-auto"
            style={{ maxHeight: "calc(85vh - 100px)" }}
            onScroll={checkScroll}
          >
            <div
              className="pointer-events-none select-none"
              dangerouslySetInnerHTML={{ __html: SAMPLE_EMAIL_HTML }}
            />
          </div>
          {/* Bottom fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-6 z-10 pointer-events-none transition-opacity duration-300"
            style={{
              opacity: canScrollDown ? 1 : 0,
              background: "linear-gradient(to top, hsl(var(--background) / 0.9), transparent)",
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/50 bg-card">
          <p className="text-[9px] text-muted-foreground/60 text-center leading-relaxed">
            Sample data shown · Actual emails include your tracked permits and live dates
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailPreviewModal;
