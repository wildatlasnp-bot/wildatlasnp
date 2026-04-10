import { useState, useEffect, useCallback } from "react";
import { Mail } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const CheckEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const email = (location.state as any)?.email as string | undefined;
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!sent) return;
    const id = window.setTimeout(() => setSent(false), 3000);
    return () => window.clearTimeout(id);
  }, [sent]);

  const handleResend = useCallback(async () => {
    if (busy || sent) return;
    if (!email) {
      toast({ title: "Email unavailable", description: "Go back and request a new confirmation email." });
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/app" },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      toast({ title: "Trail hiccup", description: "Couldn't resend. Try again in a moment." });
    } finally {
      setBusy(false);
    }
  }, [busy, sent, email, toast]);

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "#F0EDEA",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ height: "10vh", flexShrink: 0 }} />

      <div style={{ width: "100%", maxWidth: 320, margin: "0 auto", textAlign: "center", padding: "0 20px" }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "#1A2F1E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
          }}
        >
          <Mail size={32} color="#FFFFFF" strokeWidth={1.5} />
        </div>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(38px, 10.4vw, 42px)",
            fontWeight: 400,
            color: "#1A2F1E",
            marginTop: 28,
            marginBottom: 0,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          Check your email
        </h1>

        <div
          style={{
            width: 48,
            height: 1,
            backgroundColor: "rgba(26,47,30,0.2)",
            margin: "16px auto",
          }}
        />

        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            color: "#5a5a4a",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          We sent a confirmation link to your inbox. Click it to activate your account and start getting permit alerts.
        </p>

        <div
          style={{
            marginTop: 32,
            border: "1px solid rgba(47,111,78,0.25)",
            borderRadius: 12,
            padding: "16px 20px",
            textAlign: "left",
            background: "transparent",
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#1A2F1E",
              margin: 0,
              marginBottom: 10,
            }}
          >
            Don't see it?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Check your spam or junk folder", "Make sure you entered the right email", "Allow a few minutes for delivery"].map((t) => (
              <p
                key={t}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: "#5a5a4a",
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ marginRight: 6 }}>•</span>
                {t}
              </p>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, textAlign: "center", minHeight: 20 }}>
          {sent ? (
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: "#2F6F4E",
              }}
            >
              Sent ✓
            </span>
          ) : (
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: "#888878",
              }}
            >
              Didn't get it?{" "}
              <button
                onClick={handleResend}
                disabled={busy}
                style={{
                  color: "#2F6F4E",
                  textDecoration: "underline",
                  textDecorationThickness: "1px",
                  textUnderlineOffset: "2px",
                  background: "none",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.6 : 1,
                  font: "inherit",
                }}
              >
                Resend email
              </button>
            </span>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0, paddingBottom: 40, textAlign: "center" }}>
        <span
          onClick={() => navigate("/auth")}
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: "#888878",
            cursor: "pointer",
          }}
        >
          ← Back to sign in
        </span>
      </div>
    </div>
  );
};

export default CheckEmailPage;
