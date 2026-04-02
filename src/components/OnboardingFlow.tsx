import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ALL_PARK_IDS, PARKS, getPermitIcon, getParkConfig } from "@/lib/parks";
import posthog from "@/lib/posthog";
import ProModal from "@/components/ProModal";

interface Props {
  onComplete: (initialTab?: "sniper" | "mochi" | "discover") => void;
  userId: string;
  initialStep?: number;
}

interface PermitOption {
  name: string;
  description: string | null;
}

/* ─── Progress dots ─── */
const ProgressDots = ({ current }: { current: number }) => {
  const colors = Array.from({ length: 3 }, (_, i) => {
    if (current === 2) return "#2F6F4E"; // all complete on step 3
    if (i < current) return "#A8C4B8";   // completed
    if (i === current) return "#2F6F4E";  // active
    return "rgba(168,196,184,0.35)";      // upcoming
  });

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16, marginBottom: 24 }}>
      {colors.map((color, i) => (
        <div
          key={i}
          style={{
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: color,
            transition: "background-color 0.3s ease",
          }}
        />
      ))}
    </div>
  );
};

/* ─── Pulse dot animation ─── */
const pulseKeyframes = `
@keyframes onboarding-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}
`;

const OnboardingFlow = ({ onComplete, userId, initialStep = 0 }: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState(() => {
    const clamped = Math.min(Math.max(initialStep, 0), 2);
    if (clamped === 0) posthog.capture("onboarding_started");
    else posthog.capture("onboarding_resumed", { step: clamped });
    return clamped;
  });

  // Step 1: Park selection (multi-select)
  const [selectedParks, setSelectedParks] = useState<string[]>([]);
  const [proModalOpen, setProModalOpen] = useState(false);
  const selectedPark = selectedParks[0] ?? null;

  // Step 2: Permit selection
  const [permitOptions, setPermitOptions] = useState<PermitOption[]>([]);
  const [selectedPermit, setSelectedPermit] = useState<string | null>(null);
  const [permitsLoading, setPermitsLoading] = useState(false);

  // Step 3: Activation
  const [saving, setSaving] = useState(false);

  // Load permits when moving to step 2
  useEffect(() => {
    if (step !== 1 || !selectedPark) return;
    setPermitsLoading(true);
    setSelectedPermit(null);
    supabase
      .from("park_permits")
      .select("name, description")
      .eq("park_id", selectedPark)
      .eq("is_active", true)
      .then(({ data }) => {
        const opts = data ?? [];
        setPermitOptions(opts);
        if (opts.length > 0) setSelectedPermit(opts[0].name);
        setPermitsLoading(false);
      });
  }, [step, selectedPark]);

  const persistStep = (s: number) => {
    supabase.rpc("update_onboarding_step", { p_user_id: userId, p_step: s })
      .then(({ error }) => { if (error) console.error("Step persist error:", error); });
  };

  const handleParkToggle = (parkId: string) => {
    setSelectedParks((prev) =>
      prev.includes(parkId) ? prev.filter((p) => p !== parkId) : [...prev, parkId]
    );
  };

  const handleContinueParks = () => {
    if (selectedParks.length === 0) return;
    if (selectedParks.length >= 2) {
      setProModalOpen(true);
      return;
    }
    setStep(1);
    persistStep(1);
  };

  const handlePermitConfirm = async () => {
    if (!selectedPermit || !selectedPark) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("create_or_join_watch", {
        p_user_id: userId,
        p_park_id: selectedPark,
        p_permit_name: selectedPermit,
      });
      if (error) throw error;

      // Store pending permit for recovery
      localStorage.setItem("wildatlas_pending_permit", JSON.stringify({
        permit_name: selectedPermit,
        park_id: selectedPark,
      }));

      posthog.capture("permit_tracker_added", { permit_name: selectedPermit, park_id: selectedPark });
      window.dispatchEvent(new Event("watches-changed"));

      setStep(2);
      persistStep(2);
    } catch (e: any) {
      toast({ title: "Trail hiccup", description: "Couldn't start tracking. Please try again!" });
    } finally {
      setSaving(false);
    }
  };

  const finishOnboarding = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("complete_onboarding", { p_user_id: userId });
      if (error) {
        console.error("[onboarding] complete_onboarding RPC error:", error.message);
        toast({ title: "Couldn't save your profile", description: "Something went wrong. Please try again.", variant: "destructive" });
        return;
      }

      localStorage.setItem("wildatlas_onboarded", "true");
      localStorage.setItem("wildatlas_user_intent", "permits");
      localStorage.removeItem("wildatlas_pending_permit");

      // Store first-session context for Mochi
      localStorage.setItem("wildatlas_first_session", JSON.stringify({
        parkId: selectedPark ?? "",
        parkName: selectedPark ? (PARKS[selectedPark]?.shortName ?? "") : "",
        permitName: selectedPermit ?? "",
        phone: "",
      }));

      // Fire welcome email (non-blocking)
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.email) {
        const displayName = userData.user.user_metadata?.full_name
          || userData.user.user_metadata?.name
          || userData.user.email?.split("@")[0] || "";
        supabase.functions.invoke("send-welcome-email", {
          body: {
            email: userData.user.email,
            firstName: displayName.split(" ")[0],
            permitName: selectedPermit ?? "",
            parkName: selectedPark ? (PARKS[selectedPark]?.shortName ?? "") : "",
            phone: "",
          },
        }).catch((err) => console.error("Welcome email failed:", err));
      }

      posthog.capture("onboarding_completed");
      onComplete("sniper");
    } finally {
      setSaving(false);
    }
  };

  const slideVariants = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto relative overflow-hidden" style={{ backgroundColor: step === 2 ? "#1A2E1F" : "var(--wa-cream)" }}>
      <style>{pulseKeyframes}</style>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={slideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="flex-1 flex flex-col"
        >
          {/* ═══════ STEP 1: Park Picker ═══════ */}
          {step === 0 && (
            <div className="flex-1 flex flex-col">
              <ProgressDots current={0} />

              <div className="flex-1 flex flex-col overflow-y-auto px-7 pb-8">
                <h1 style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 400,
                  lineHeight: 1.08, color: "var(--wa-ink)", marginBottom: 6,
                }}>
                  Where are you<br />
                  <span style={{ fontStyle: "italic", color: "var(--wa-green)" }}>headed?</span>
                </h1>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 300,
                  color: "var(--wa-ink-mid)", lineHeight: 1.55, marginBottom: 20,
                }}>
                  Pick your parks — select as many as you like.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingBottom: selectedParks.length > 0 ? 80 : 0 }}>
                  {ALL_PARK_IDS.map((id) => {
                    const park = getParkConfig(id);
                    const selected = selectedParks.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => handleParkToggle(id)}
                        style={{
                          position: "relative", height: 160, borderRadius: 12,
                          overflow: "hidden", cursor: "pointer", padding: 0,
                          border: selected ? "2.5px solid #2F6F4E" : "2px solid transparent",
                          transform: selected ? "scale(1.02)" : "scale(0.97)",
                          transition: "all 150ms ease",
                        }}
                      >
                        {park.heroImage && (
                          <img
                            src={park.heroImage}
                            alt={park.shortName}
                            style={{
                              position: "absolute", inset: 0, width: "100%", height: "100%",
                              objectFit: "cover", display: "block",
                            }}
                          />
                        )}
                        <div style={{
                          position: "absolute", inset: 0,
                          background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 45%, transparent 100%)",
                        }} />
                        {selected && (
                          <div style={{
                            position: "absolute", top: 8, right: 8, width: 22, height: 22,
                            borderRadius: "50%", backgroundColor: "#2F6F4E",
                            border: "2px solid white",
                            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2,
                          }}>
                            <Check size={11} strokeWidth={3} style={{ color: "white" }} />
                          </div>
                        )}
                        <div style={{
                          position: "absolute", bottom: 12, left: 12, zIndex: 1, textAlign: "left",
                        }}>
                          <span style={{
                            fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 500,
                            color: "white", display: "block", marginBottom: 2,
                          }}>
                            {park.shortName}
                          </span>
                          <span style={{
                            fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                            letterSpacing: "0.04em",
                            color: "rgba(255,255,255,0.8)", display: "block",
                          }}>
                            {park.region}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Floating continue button */}
              <AnimatePresence>
                {selectedParks.length > 0 && (
                  <motion.button
                    key={selectedParks.length === 1 ? "single" : "multi"}
                    initial={{ opacity: 0, y: 16, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, y: 16, x: "-50%" }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    onClick={handleContinueParks}
                    style={{
                      position: "fixed", bottom: 24, left: "50%",
                      width: "min(320px, calc(100% - 48px))",
                      height: 52, borderRadius: 12, border: "none",
                      backgroundColor: "#2F6F4E", color: "white",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
                      cursor: "pointer", zIndex: 50,
                    }}
                  >
                    {selectedParks.length === 1
                      ? `Continue with ${PARKS[selectedParks[0]]?.shortName ?? selectedParks[0]} →`
                      : `Continue with ${selectedParks.length} parks — Pro required →`}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Pro upgrade modal */}
          <ProModal
            open={proModalOpen}
            onOpenChange={(open) => {
              setProModalOpen(open);
              if (!open && selectedParks.length >= 2) {
                // On dismiss with multi-select, proceed with first park as free fallback
              }
            }}
          />

          {/* ═══════ STEP 2: Permit Picker ═══════ */}
          {step === 1 && (
            <div className="flex-1 flex flex-col">
              <ProgressDots current={1} />

              <div className="flex-1 flex flex-col overflow-y-auto px-7 pb-8">
                <h1 style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 400,
                  lineHeight: 1.08, color: "var(--wa-ink)", marginBottom: 6,
                }}>
                  What permits do<br />
                  <span style={{ fontStyle: "italic", color: "var(--wa-green)" }}>you need?</span>
                </h1>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 300,
                  color: "var(--wa-ink-mid)", lineHeight: 1.55, marginBottom: 20,
                }}>
                  {PARKS[selectedPark!]?.shortName} — select a permit to track.
                </p>

                {permitsLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--wa-green)" }} />
                  </div>
                ) : permitOptions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0" }}>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "var(--wa-ink)", marginBottom: 6 }}>
                      No permits available yet
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 300, color: "var(--wa-ink-muted)", lineHeight: 1.5, maxWidth: 260, margin: "0 auto" }}>
                      This park doesn't have scannable permits right now. Try picking a different park.
                    </p>
                    <button
                      onClick={() => { setStep(0); persistStep(0); }}
                      style={{
                        marginTop: 16, padding: "10px 24px", borderRadius: 10,
                        border: "1px solid var(--wa-rule)", background: "transparent",
                        fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                        color: "var(--wa-green)", cursor: "pointer",
                      }}
                    >
                      ← Pick another park
                    </button>
                  </div>
                ) : permitOptions.length === 1 ? (
                  /* ─── Single-permit: compact confirmation + park hero ─── */
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Confirmation card */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: 14, borderRadius: 12,
                      border: "1px solid #A8C4B8",
                      background: "var(--wa-white)",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 500, color: "var(--wa-ink)", display: "block" }}>
                          {permitOptions[0].name}
                        </span>
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 300, color: "var(--wa-ink-muted)", marginTop: 3, display: "block" }}>
                          The only permit type at {PARKS[selectedPark!]?.shortName}
                        </span>
                      </div>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        backgroundColor: "#2F6F4E",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Check size={12} strokeWidth={3} style={{ color: "white" }} />
                      </div>
                    </div>

                    {/* Park hero image */}
                    {PARKS[selectedPark!]?.heroImage && (
                      <div style={{
                        position: "relative", borderRadius: 12, overflow: "hidden",
                        height: 220,
                      }}>
                        <img
                          src={PARKS[selectedPark!].heroImage}
                          alt={PARKS[selectedPark!].shortName}
                          style={{
                            width: "100%", height: "100%", objectFit: "cover", display: "block",
                            objectPosition: ({ arches: "center 25%", grand_canyon: "center 40%", grand_teton: "center 35%", rocky_mountain: "center 30%", glacier: "center center" } as Record<string, string>)[selectedPark!] ?? "center center",
                          }}
                        />
                        <div style={{
                          position: "absolute", inset: 0,
                          background: "linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.55) 40%, transparent 70%)",
                        }} />
                        <span style={{
                          position: "absolute", bottom: 12, left: 14, zIndex: 1,
                          fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontStyle: "italic",
                          fontWeight: 400, color: "#FFFFFF",
                        }}>
                          {PARKS[selectedPark!].shortName} · {PARKS[selectedPark!].region}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {permitOptions.map((permit) => {
                      const selected = selectedPermit === permit.name;
                      const Icon = getPermitIcon(permit.name);
                      return (
                        <button
                          key={permit.name}
                          onClick={() => setSelectedPermit(permit.name)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: 14, borderRadius: 12, width: "100%",
                            border: `1px solid ${selected ? "rgba(47,111,78,0.4)" : "var(--wa-rule)"}`,
                            background: selected ? "var(--wa-green-light)" : "var(--wa-white)",
                            cursor: "pointer", textAlign: "left", transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{
                            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            backgroundColor: selected ? "rgba(47,111,78,0.12)" : "#F0EDEA",
                          }}>
                            <Icon size={15} strokeWidth={1.5} style={{ color: selected ? "var(--wa-green)" : "var(--wa-ink-muted)" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "var(--wa-ink)", display: "block" }}>
                              {permit.name}
                            </span>
                            {permit.description && (
                              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 300, color: "var(--wa-ink-muted)", marginTop: 2, display: "block" }}>
                                {permit.description}
                              </span>
                            )}
                          </div>
                          {selected && (
                            <div style={{
                              width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                              backgroundColor: "var(--wa-green)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <Check size={10} strokeWidth={3} style={{ color: "white" }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer — hidden when no permits */}
              {permitOptions.length > 0 && <div style={{ padding: "20px 28px 36px", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => { setStep(0); persistStep(0); }}
                    style={{
                      width: 44, height: 44, minWidth: 44, flexShrink: 0,
                      background: "transparent", border: "1px solid var(--wa-rule)",
                      borderRadius: 10, fontSize: 16, color: "var(--wa-ink-mid)",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ←
                  </button>
                  <button
                    onClick={handlePermitConfirm}
                    disabled={!selectedPermit || saving}
                    style={{
                      flex: 1, padding: 15, borderRadius: 10, border: "none",
                      backgroundColor: selectedPermit ? "var(--wa-green)" : "#D1D5DB",
                      color: selectedPermit ? "var(--wa-cream)" : "#888",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500,
                      letterSpacing: "0.06em", textTransform: "uppercase" as const,
                      cursor: selectedPermit ? "pointer" : "not-allowed",
                      transition: "background-color 200ms ease-in",
                    }}
                  >
                    {saving ? "SETTING UP..." : "START TRACKING →"}
                  </button>
                </div>
              </div>}
            </div>
          )}

          {/* ═══════ STEP 3: Activation — "You're locked in." ═══════ */}
          {step === 2 && (
            <div className="flex-1 flex flex-col" style={{ backgroundColor: "#1A2E1F" }}>
              <ProgressDots current={2} />

              <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ padding: "0 28px" }}>
                <img
                  src="/mochi-standing.png"
                  alt="Mochi"
                  style={{ width: 96, objectFit: "contain", marginBottom: 20, background: "none", border: "none", boxShadow: "none" }}
                />

                {/* Headline with pulse dot */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      backgroundColor: "#4CAF7D",
                      animation: "onboarding-pulse 2s ease-in-out infinite",
                      flexShrink: 0,
                    }}
                  />
                  <h1 style={{
                    fontFamily: "'Cormorant Garamond', serif", fontSize: 30,
                    fontWeight: 400, fontStyle: "italic",
                    color: "#F0EDEA", margin: 0,
                  }}>
                    Scanner is live.
                  </h1>
                </div>

                {/* Subtext */}
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 15,
                  color: "rgba(240,237,234,0.65)", maxWidth: 300,
                  textAlign: "center", marginTop: 12, lineHeight: 1.55,
                }}>
                  I'm checking Recreation.gov every 2 minutes. I'll alert you the moment a{" "}
                  <strong style={{ color: "rgba(240,237,234,0.85)", fontWeight: 500 }}>{selectedPermit ?? "permit"}</strong>
                  {" "}permit opens.
                </p>
              </div>

              {/* CTA */}
              <div style={{ padding: "0 24px 36px", flexShrink: 0 }}>
                <button
                  onClick={finishOnboarding}
                  disabled={saving}
                  style={{
                    width: "100%", maxWidth: 340, margin: "0 auto", display: "block",
                    height: 52, borderRadius: 14, border: "none",
                    backgroundColor: "#2F6F4E", color: "#F0EDEA",
                    fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 500,
                    cursor: saving ? "wait" : "pointer",
                    transition: "opacity 200ms ease",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "Setting up..." : "Go to My Alerts"}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OnboardingFlow;
