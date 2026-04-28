import { useState, useEffect, useMemo, useCallback, forwardRef, useRef, memo } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Share2, AlertTriangle, CalendarIcon, Sunrise, Car, Snowflake, Camera,
  Thermometer, TreePine, ChevronRight, Sun, Radar,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import CrowdWindows from "@/components/CrowdWindows";
import TripDateModal from "@/components/TripDateModal";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { PARKS } from "@/lib/parks";
import {
  getSunEphemeris, getParkLocalTime, getPhotoGradeFilter,
  getPhotoOverlayColor, formatCoordinates, formatCountdown,
} from "@/lib/discover-utils";
import PokoReadCard from "@/components/discover/PokoReadCard";
import FieldLog from "@/components/discover/FieldLog";
import HeroLightbox from "@/components/discover/HeroLightbox";
import ParkSelector from "@/components/ParkSelector";
import { seasons, getCurrentSeason, parkSeasons, type Season } from "@/lib/park-seasons";
import TodayParkAdvice from "@/components/TodayParkAdvice";
import { useRecentFinds } from "@/hooks/useRecentFinds";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSettlingSkeleton } from "@/hooks/useSettlingSkeleton";

import yosemiteHero from "@/assets/yosemite-hero.jpg";
import rainierHero from "@/assets/rainier-hero.jpg";
import zionHero from "@/assets/zion-hero.jpg";
import glacierHero from "@/assets/glacier-hero.jpg";
import rockyMountainHero from "@/assets/rocky-mountain-hero.jpg";
import archesHero from "@/assets/arches-hero.jpg";
import grandCanyonHero from "@/assets/grand-canyon-hero.jpg";
import grandTetonHero from "@/assets/grand-teton-hero.jpg";

/* ── Forecast pill background tinted to park color, hue-clamped to greens ── */
function badgeBg(hex: string | undefined, opacity = 0.85): string {
  const c = hex ?? "#2F6F4E";
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  if (h < 90 || h > 180) return `rgba(47,111,78,${opacity})`;
  return `rgba(${r},${g},${b},${opacity})`;
}

/* ── Roman numeral helper for section plates ── */
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/* ── Tip theme classifier — derives a cluster from each tip's icon name.
   Used to group ranger notes into editorially scannable clusters. ── */
type TipTheme = "trail" | "wildlife" | "weather" | "logistics" | "moments";

const THEME_LABELS: Record<TipTheme, string> = {
  trail: "On the trail",
  wildlife: "Wildlife & habitat",
  weather: "Weather & sky",
  logistics: "Plan & permits",
  moments: "Moments to catch",
};
/* Stable ordering for clusters — keeps layout deterministic across seasons */
const THEME_ORDER: TipTheme[] = ["trail", "wildlife", "weather", "logistics", "moments"];

const classifyTip = (tip: { icon: any; title?: string }): TipTheme => {
  const iconName = String(tip?.icon?.displayName ?? tip?.icon?.name ?? "").toLowerCase();
  const title = String(tip?.title ?? "").toLowerCase();
  const hay = `${iconName} ${title}`;
  if (/(mountain|footprint|tent|trail|trees?|tree.?pine|hike|hiking)/.test(hay)) return "trail";
  if (/(leaf|flower|bear|wildlife|paw|fish|bird|animal|deer|salmon)/.test(hay)) return "wildlife";
  if (/(snow|cloud|rain|sun|wind|thermo|weather|storm|temp)/.test(hay)) return "weather";
  if (/(camera|photo|moment|firefall|aurora|stargaz|sunset|sunrise)/.test(hay)) return "moments";
  return "logistics"; // car, mappin, hotel, alert, flame (fire safety), droplet, etc.
};

/* ─────────────────────────────────────────────────────────────────
   Hero & Highlight metadata — exported for the regression suite.
   ───────────────────────────────────────────────────────────────── */

interface HeroConfig {
  image: string;
  alt: string;
  objectPosition: string;
}

export const parkHeroes: Record<string, HeroConfig> = {
  yosemite:       { image: yosemiteHero,      alt: "Yosemite Half Dome at golden hour",                     objectPosition: "center 35%" },
  rainier:        { image: rainierHero,       alt: "Mount Rainier above wildflower meadows",                objectPosition: "center 25%" },
  zion:           { image: zionHero,          alt: "Zion Narrows slot canyon with Virgin River",            objectPosition: "center 45%" },
  glacier:        { image: glacierHero,       alt: "Glacier National Park turquoise lake and peaks",        objectPosition: "center 25%" },
  rocky_mountain: { image: rockyMountainHero, alt: "Rocky Mountain National Park alpine meadow at sunset",  objectPosition: "center 35%" },
  arches:         { image: archesHero,        alt: "Delicate Arch in Arches National Park",                 objectPosition: "center 50%" },
  grand_canyon:   { image: grandCanyonHero,   alt: "Grand Canyon South Rim at sunrise",                     objectPosition: "center 40%" },
  grand_teton:    { image: grandTetonHero,    alt: "Grand Teton peaks above Jenny Lake",                    objectPosition: "center 30%" },
};

const decodedImages = new Set<string>();
function preDecodeHeroImages() {
  Object.values(parkHeroes).forEach((h) => {
    if (decodedImages.has(h.image)) return;
    const img = new Image();
    img.src = h.image;
    img.decode?.().then(() => decodedImages.add(h.image)).catch(() => {});
  });
}
preDecodeHeroImages();

interface HighlightCard {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const parkHighlights: Record<string, HighlightCard[]> = {
  yosemite: [
    { icon: Sunrise, title: "Best Sunrise Spot", description: "Glacier Point for unobstructed valley views." },
    { icon: Car, title: "Parking Tip", description: "Valley lots fill by 8am on weekends." },
    { icon: Snowflake, title: "Season Note", description: "Tioga Road closed November through May." },
    { icon: Camera, title: "Hidden Gem", description: "Mirror Lake trail quietest before 7am." },
  ],
  rainier: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Sunrise Point for dawn alpenglow on the summit." },
    { icon: Car, title: "Arrival Tip", description: "Paradise lot full by 10am June–September." },
    { icon: Snowflake, title: "Season Note", description: "Most roads close mid-November to late May." },
    { icon: Camera, title: "Hidden Gem", description: "Spray Park meadows rival Paradise with fewer crowds." },
  ],
  zion: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Canyon Overlook Trail for sunrise valley panoramas." },
    { icon: Car, title: "Parking Tip", description: "Use Springdale shuttle; visitor center lot fills by 8am." },
    { icon: Thermometer, title: "Season Note", description: "Summer temps exceed 105°F on exposed trails." },
    { icon: Camera, title: "Hidden Gem", description: "Observation Point via East Mesa quietest at dawn." },
  ],
  glacier: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Logan Pass for sunrise over Hidden Lake." },
    { icon: Car, title: "Arrival Tip", description: "Going-to-the-Sun Road requires vehicle reservation." },
    { icon: Snowflake, title: "Season Note", description: "Full road typically open early July through mid-October." },
    { icon: Camera, title: "Hidden Gem", description: "Iceberg Lake trail sees half the Highline crowds." },
  ],
  rocky_mountain: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Trail Ridge Road pullouts for alpine sunrise views." },
    { icon: Car, title: "Arrival Tip", description: "Bear Lake corridor needs timed entry by 9am." },
    { icon: TreePine, title: "Season Note", description: "Elk rut in late September draws large crowds." },
    { icon: Camera, title: "Hidden Gem", description: "Wild Basin trails are quieter than Bear Lake." },
  ],
  arches: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Delicate Arch at sunset is a must-see experience." },
    { icon: Car, title: "Arrival Tip", description: "Timed entry required April through October." },
    { icon: Thermometer, title: "Season Note", description: "Summer ground temps exceed 130°F on slickrock." },
    { icon: Camera, title: "Hidden Gem", description: "Tower Arch via back road avoids all crowds." },
  ],
  grand_canyon: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Mather Point at sunrise before crowds arrive." },
    { icon: Car, title: "Parking Tip", description: "Visitor Center lot fills by 9 AM peak season." },
    { icon: Thermometer, title: "Season Note", description: "Inner canyon hits 115°F — hike before 7 AM in summer." },
    { icon: Camera, title: "Hidden Gem", description: "Desert View Watchtower is 25 miles east with far fewer crowds." },
  ],
  grand_teton: [
    { icon: Sunrise, title: "Best Viewpoint", description: "Schwabacher Landing at dawn for Teton reflections." },
    { icon: Car, title: "Parking Tip", description: "Jenny Lake fills by 8 AM — String Lake is the backup." },
    { icon: Snowflake, title: "Season Note", description: "Teton Park Road closes November 1 through April." },
    { icon: Camera, title: "Hidden Gem", description: "Phelps Lake overlook trail avoids all Jenny Lake crowds." },
  ],
};

const SHARE_TITLE = "WildAtlas - National Park Permit Alerts";
const SHARE_TEXT  = "Check out WildAtlas — I'm using it to track national park permit cancellations. Join here:";
const SHARE_URL   = "https://wildatlas.app";

/* ── Editorial body — collapses long blurbs to 3 sentences ── */
const SeasonalBlurb = ({ body }: { body: string }) => {
  const sentences = body.match(/[^.!?]+[.!?]+/g) ?? [body];
  const needsCollapse = sentences.length > 3;
  const preview = needsCollapse ? sentences.slice(0, 3).join("") : body;
  const [expanded, setExpanded] = useState(!needsCollapse);
  return (
    <>
      <p className="wa-dropcap" style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 15, fontWeight: 400, color: "#2A2A26",
        lineHeight: 1.7, letterSpacing: "0.005em", margin: 0,
      }}>
        {expanded ? body : preview}
      </p>
      {needsCollapse && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
            fontSize: 14, color: "#C9A96E", background: "none", border: "none",
            padding: 0, cursor: "pointer", marginTop: 12, textDecoration: "underline",
            textUnderlineOffset: 4, textDecorationColor: "rgba(201,169,110,0.4)",
          }}
        >
          continue reading →
        </button>
      )}
    </>
  );
};

/* ── Scroll-driven reveal wrapper for editorial sections ──
   Wraps a section so it fades + rises into view as the user scrolls
   through Discover. Stagger via `delay` (ms). Honors prefers-reduced-motion. */
const RevealSection = ({
  children,
  className = "",
  style,
  delay = 0,
  as: As = "section" as any,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  as?: any;
}) => {
  const { ref, visible } = useScrollReveal<HTMLElement>();
  return (
    <As
      ref={ref as any}
      className={`wa-scroll-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ ...(style || {}), ["--d" as any]: `${delay}ms` }}
    >
      {children}
    </As>
  );
};

/* ── Section plate header: eyebrow + roman numeral + hairline rule ── */
const SectionPlate = ({
  numeral, eyebrow, italic, dark = false, delay = 0,
}: { numeral: string; eyebrow: string; italic?: string; dark?: boolean; delay?: number }) => (
  <div className="wa-reveal" style={{ ["--d" as any]: `${delay}ms`, marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
      <span
        className="wa-plate-eyebrow"
        style={{ color: dark ? "rgba(232,217,181,0.78)" : "#6B6860" }}
      >
        {eyebrow}
      </span>
      <span
        className="wa-plate-numeral"
        style={{ color: dark ? "#E8D9B5" : "#C9A96E" }}
        aria-hidden="true"
      >
        — {numeral}
      </span>
    </div>
    <span className="wa-rule-solid" style={{ ["--d" as any]: `${delay + 120}ms`, background: dark ? "rgba(232,217,181,0.45)" : "rgba(201,169,110,0.55)" }} />
    {italic && (
      <p style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontStyle: "italic", fontWeight: 400, fontSize: 14,
        color: dark ? "rgba(232,217,181,0.78)" : "#6B6860",
        margin: "10px 0 0", letterSpacing: "0.01em",
      }}>
        {italic}
      </p>
    )}
  </div>
);

/* ── About-Patterns disclosure (kept) ── */
function TypicalPatternsHeader() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 14 }}>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "rgba(232,217,181,0.78)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}
      >
        Typical patterns
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="About typical patterns data"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "rgba(232,217,181,0.78)", fontSize: 12, lineHeight: 1 }}
        >
          ⓘ
        </button>
      </p>
      {open && (
        <div
          style={{
            position: "absolute", top: 22, left: 0, right: 0, zIndex: 20,
            background: "#243A28", border: "1px solid rgba(201,169,110,0.28)",
            borderRadius: 10, padding: "12px 14px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          }}
        >
          <button
            onClick={() => setOpen(false)} aria-label="Close"
            style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "rgba(232,217,181,0.78)", padding: 2 }}
          >
            <X size={12} />
          </button>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, color: "rgba(232,217,181,0.85)", paddingRight: 16 }}>
            These times reflect average historical visitor patterns, not live conditions. Check NPS alerts and Recreation.gov for real-time updates.
          </p>
        </div>
      )}
    </div>
  );
}

interface DiscoverProps {
  parkId?: string;
  onParkChange?: (id: string) => void;
  onNavigateToSniper?: () => void;
  onNavigateToMochi?: (query?: string) => void;
}

const NOOP_PARK_CHANGE = () => {};

const DiscoverTips = forwardRef<HTMLDivElement, DiscoverProps>(({
  parkId = "yosemite", onParkChange, onNavigateToSniper, onNavigateToMochi,
}, ref) => {
  const stableParkChange = onParkChange ?? NOOP_PARK_CHANGE;
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Watched parks for the selector dropdown indicators ──
  const [watchedParkIds, setWatchedParkIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_watchers")
      .select("scan_targets(park_id)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          const ids = new Set<string>(data.map((r: any) => r.scan_targets?.park_id).filter(Boolean));
          setWatchedParkIds(ids);
        }
      });
  }, [user]);

  // ── Season + trip planning state (preserved) ──
  const [activeSeason, setActiveSeason] = useState<Season>(getCurrentSeason);
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem("wildatlas_arrival_date");
    if (!saved) return undefined;
    const date = new Date(saved);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    if (normalized < today) {
      localStorage.removeItem("wildatlas_arrival_date");
      localStorage.removeItem("wildatlas_trip_park");
      return undefined;
    }
    return date;
  });
  const [tripParkId, setTripParkId] = useState<string>(
    () => localStorage.getItem("wildatlas_trip_park") || parkId
  );
  useEffect(() => {
    if (arrivalDate && parkId !== tripParkId) setTripParkId(parkId);
  }, [parkId, arrivalDate]);

  const [tripModalOpen, setTripModalOpen] = useState(false);
  const handleTripModalSave = useCallback((modalParkId: string, date: Date) => {
    setArrivalDate(date);
    localStorage.setItem("wildatlas_arrival_date", date.toISOString());
    localStorage.setItem("wildatlas_trip_park", modalParkId);
    setTripParkId(modalParkId);
  }, []);
  const handleTripRemove = useCallback(() => {
    setArrivalDate(undefined);
    localStorage.removeItem("wildatlas_arrival_date");
    localStorage.removeItem("wildatlas_trip_park");
  }, []);

  // ── Hero forecast / image state ──
  const [heroForecast, setHeroForecast] = useState<{ location: string; status: string; quietsAfter: string } | null>(null);
  const [heroImgLoaded, setHeroImgLoaded] = useState(false);
  const [heroImgError, setHeroImgError] = useState(false);
  const [liveAlertExpanded, setLiveAlertExpanded] = useState(false);
  const heroImgRef = useRef<HTMLImageElement | null>(null);

  // ── Hero lightbox (cinematic in-page image viewer) ──
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxOrigin, setLightboxOrigin] = useState<DOMRect | null>(null);
  const openLightbox = useCallback(() => {
    if (heroImgError || !heroImgLoaded) return;
    const rect = heroImgRef.current?.getBoundingClientRect() ?? null;
    setLightboxOrigin(rect);
    setLightboxOpen(true);
  }, [heroImgError, heroImgLoaded]);

  // ── Hero parallax: subtle vertical drift driven by scroll position.
  //    Honors prefers-reduced-motion (CSS guards animation; we also no-op here).
  useEffect(() => {
    const scrollEl =
      typeof ref === "function" || !ref
        ? null
        : (ref as React.RefObject<HTMLDivElement>).current;
    if (!scrollEl) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const img = heroImgRef.current;
      if (!img) return;
      // Damped translate: max ~28px downward shift across the hero's height.
      const y = Math.min(scrollEl.scrollTop * 0.18, 28);
      img.style.setProperty("--wa-parallax", `${y.toFixed(1)}px`);
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [ref, parkId]);

  // ── Wall-clock-aligned tick ──
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    let timeoutId: number;
    let intervalId: number;
    const scheduleNextBoundary = () => {
      const n = new Date();
      const msToNextMinute = 60_000 - (n.getSeconds() * 1000 + n.getMilliseconds()) + 8;
      timeoutId = window.setTimeout(() => {
        setNow(new Date());
        intervalId = window.setInterval(() => setNow(new Date()), 60_000);
      }, msToNextMinute);
    };
    scheduleNextBoundary();
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  const sun = useMemo(() => getSunEphemeris(parkId, now), [parkId, now]);
  const localTime = useMemo(() => getParkLocalTime(parkId, now), [parkId, now]);
  const photoFilter = useMemo(() => getPhotoGradeFilter(sun.phase), [sun.phase]);
  const photoOverlay = useMemo(() => getPhotoOverlayColor(sun.phase), [sun.phase]);
  const coords = useMemo(() => formatCoordinates(parkId), [parkId]);

  // ── Live Alert snapshot — bucketed to whole minutes ──
  const liveAlertSnapshot = useMemo(() => {
    const mins = sun.minutesToNextEvent;
    if (mins === null || mins < 0 || mins > 30) return null;
    const eventType: "sunrise" | "sunset" =
      sun.nextEventLabel === "Sunrise" ? "sunrise" : "sunset";
    return {
      eventType, mins,
      eventLabel: eventType === "sunrise" ? sun.sunriseLabel : sun.sunsetLabel,
    };
  }, [sun.minutesToNextEvent, sun.nextEventLabel, sun.sunriseLabel, sun.sunsetLabel]);

  const lastEventTypeRef = useRef<"sunrise" | "sunset" | null>(null);
  useEffect(() => {
    const current = liveAlertSnapshot?.eventType ?? null;
    if (lastEventTypeRef.current !== current) {
      if (liveAlertExpanded) setLiveAlertExpanded(false);
      lastEventTypeRef.current = current;
    }
  }, [liveAlertSnapshot?.eventType, liveAlertExpanded]);

  const handleTipNavigate = useCallback((tipId: string) => {
    const el = document.getElementById(`tip-${tipId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("wa-tip-flash");
    void (el as HTMLElement).offsetWidth;
    el.classList.add("wa-tip-flash");
    window.setTimeout(() => el.classList.remove("wa-tip-flash"), 1800);
  }, []);

  const parkConfig = PARKS[parkId];
  const seasonContent = parkSeasons[parkId];
  const hero = parkHeroes[parkId];
  const data = useMemo(() => seasonContent?.[activeSeason], [seasonContent, activeSeason]);

  // ── Tip clusters: group active-season tips by theme, preserve original order within each cluster.
  const tipClusters = useMemo(() => {
    if (!data?.tips) return [] as Array<{ theme: TipTheme; label: string; tips: Array<{ tip: any; idx: number }> }>;
    const groups = new Map<TipTheme, Array<{ tip: any; idx: number }>>();
    data.tips.forEach((tip, idx) => {
      const theme = classifyTip(tip);
      const arr = groups.get(theme) ?? [];
      arr.push({ tip, idx });
      groups.set(theme, arr);
    });
    return THEME_ORDER
      .filter((t) => groups.has(t))
      .map((t) => ({ theme: t, label: THEME_LABELS[t], tips: groups.get(t)! }));
  }, [data]);

  // ── Cross-season tips: at most 4 curated notes from other seasons, dedup by id/title.
  const crossSeasonTips = useMemo(() => {
    if (!seasonContent) return [] as Array<any>;
    const out: any[] = [];
    const seen = new Set<string>();
    for (const t of data?.tips ?? []) {
      const k = String(t?.id ?? t?.title ?? "").trim();
      if (k) seen.add(k);
    }
    const MAX = 4;
    for (const s of seasons) {
      if (s === activeSeason) continue;
      const sd = seasonContent[s];
      for (const tip of sd?.tips ?? []) {
        const key = String(tip?.id ?? tip?.title ?? "").trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ ...tip, _seasonLabel: sd.label, _seasonKey: s });
        if (out.length >= MAX) break;
      }
      if (out.length >= MAX) break;
    }
    return out;
  }, [seasonContent, data, activeSeason]);

  const [crossSeasonOpen, setCrossSeasonOpen] = useState(false);
  useEffect(() => { setCrossSeasonOpen(false); }, [activeSeason, parkId]);

  // ── Cluster collapse state ── tap a theme header to fold/unfold its tips.
  // Reset on park or season change so users always start with everything open.
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());
  useEffect(() => { setCollapsedClusters(new Set()); }, [parkId, activeSeason]);
  const toggleCluster = useCallback((theme: string) => {
    setCollapsedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  }, []);

  // ── Premium "settling" beat ── brief shimmer when park or season changes,
  // so highlight + ranger cards crossfade in instead of snapping.
  const cardsSettling = useSettlingSkeleton(`${parkId}|${activeSeason}`, 320);

  // ── Tip deep-links ──
  // Tap a tip's title → copy `#tip-<id>` to clipboard, update the URL hash
  // without scroll-jumping, and restore focus to the tip article so screen
  // readers and keyboard users land on the right thing.
  const copyTipLink = useCallback(
    async (tipId: string) => {
      const hash = `#tip-${tipId}`;
      try {
        // Update hash without triggering the browser's default jump.
        const url = `${window.location.pathname}${window.location.search}${hash}`;
        window.history.replaceState(null, "", url);

        const fullUrl = `${window.location.origin}${url}`;
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(fullUrl);
        }

        // Restore focus to the article so the deep-link target is announced.
        const el = document.getElementById(`tip-${tipId}`);
        if (el) {
          el.setAttribute("tabindex", "-1");
          el.focus({ preventScroll: true });
        }

        toast({
          title: "Link copied",
          description: "Share this tip — it'll open right here.",
        });
      } catch {
        toast({
          title: "Couldn't copy link",
          description: "Tap and hold the address bar to share manually.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  // On first paint (and after settling), if the URL points at a tip, scroll
  // that tip into view and focus it. Re-runs when the cluster set changes.
  useEffect(() => {
    if (cardsSettling) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#tip-")) return;
    const id = hash.slice(1);
    const tipId = id.replace(/^tip-/, "");

    // Make sure the targeted tip's cluster is expanded.
    const targetCluster = tipClusters.find((c) =>
      c.tips.some(({ tip }) => String(tip.id) === tipId)
    );
    if (targetCluster && collapsedClusters.has(targetCluster.theme)) {
      setCollapsedClusters((prev) => {
        const next = new Set(prev);
        next.delete(targetCluster.theme);
        return next;
      });
    }

    const el = document.getElementById(id);
    if (!el) return;
    // Small delay so reveal animations settle before scrolling.
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
      el.classList.add("wa-rich-tip-targeted");
      window.setTimeout(() => el.classList.remove("wa-rich-tip-targeted"), 2400);
    }, 240);
    return () => window.clearTimeout(t);
  }, [cardsSettling, parkId, activeSeason, tipClusters, collapsedClusters]);


  // ── Hero forecast load ──
  useEffect(() => {
    setHeroForecast(null);
    setHeroImgLoaded(false);
    setHeroImgError(false);
    const season = getCurrentSeason();
    const dayType = new Date().getDay() === 0 || new Date().getDay() === 6 ? "weekend" : "weekday";
    const load = async () => {
      const { data: rows } = await supabase
        .from("park_crowd_forecasts")
        .select("location_name, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet")
        .eq("park_id", parkId)
        .eq("season", season)
        .eq("day_type", dayType)
        .order("display_order")
        .limit(1);
      const f = rows?.[0];
      if (!f) return;
      if (f.peak_start === f.peak_end && f.building_time === f.peak_start) return;
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const toMin = (t: string) => {
        const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!m) return 0;
        let h = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
        if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
        return h * 60 + mm;
      };
      const qs = toMin(f.quiet_start);
      const qe = toMin(f.quiet_end);
      const ps = toMin(f.peak_start);
      const pe = toMin(f.peak_end);
      let status: string;
      let quietsAfter: string;
      if (nowMin < qs || nowMin >= toMin(f.evening_quiet)) {
        status = "Quiet"; quietsAfter = "";
      } else if (nowMin < qe) {
        status = "Quiet"; quietsAfter = "";
      } else if (nowMin < ps) {
        status = "Building"; quietsAfter = f.evening_quiet;
      } else if (nowMin < pe) {
        status = "Busy"; quietsAfter = f.evening_quiet;
      } else {
        status = "Winding down"; quietsAfter = f.evening_quiet;
      }
      setHeroForecast({ location: f.location_name, status, quietsAfter });
    };
    load();
  }, [parkId]);

  const daysUntilTrip = useMemo(() => {
    if (!arrivalDate) return null;
    const n = new Date();
    const todayLocal = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    const arrivalLocal = new Date(arrivalDate.getFullYear(), arrivalDate.getMonth(), arrivalDate.getDate());
    return differenceInDays(arrivalLocal, todayLocal);
  }, [arrivalDate]);

  const { todayCount: recentFinds, loading: findsLoading } = useRecentFinds(parkId);
  const timeWindow = "24h";

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL }); }
      catch (_) { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
      toast({ title: "Link copied!", description: "Share link copied to clipboard." });
    }
  };

  /* ── Empty / data-missing fallback (unchanged behaviour) ── */
  if (!parkConfig || !seasonContent || !hero || !data) {
    return (
      <div ref={ref} className="h-full min-h-0 overflow-y-auto" data-tab-scroll>
        <div className="px-5 pt-4 pb-1 flex items-center justify-between">
          <ParkSelector activeParkId={parkId} onParkChange={stableParkChange} watchedParkIds={watchedParkIds} />
        </div>
        <div className="flex flex-col flex-1 items-center justify-center text-center px-8 pb-20">
          <div className="max-w-[280px] mx-auto">
            <img src="/mochi-map.png" alt="Poko with map"
              style={{ width: "min(120px, 28vw)", height: "auto", objectFit: "contain" }}
              className="mx-auto mb-3" loading="lazy" />
            <p className="font-heading font-bold text-foreground text-lg mb-2">Your permits, on watch.</p>
            <p className="text-sm text-muted-foreground mb-4">
              Poko scans for openings around the clock. Set up an alert and we'll notify you the moment a permit drops.
            </p>
            <button
              onClick={() => onNavigateToSniper?.()}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-[14px] hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
            >
              Set Up Your First Alert
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ───────────────────────────────────────────────────────────
     Rendered narrative.
     Background: warm cream that yields to forest/ivory plates.
     ─────────────────────────────────────────────────────────── */
  const localTimeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: localTime.tz, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(now).replace(/\u202f/g, " ");

  const normalizeSunLabel = (label: string) => {
    const m = label.match(/^(\d{1,2}):(\d{2})([ap])$/i);
    if (!m) return label;
    return `${m[1]}:${m[2]} ${m[3].toUpperCase()}M`;
  };
  const sunriseLabel = normalizeSunLabel(sun.sunriseLabel);
  const sunsetLabel = normalizeSunLabel(sun.sunsetLabel);
  const countdownEyebrow = sun.nextEventLabel === "Sunrise" ? "Sunrise in" : "Sunset in";
  const countdownValue = formatCountdown(sun.minutesToNextEvent);

  return (
    <div
      ref={ref}
      className="h-full min-h-0 overflow-y-auto"
      data-tab-scroll
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
        background: "#F5F0E8",
      }}
    >
      {/* ═══════════════════════ I. MASTHEAD ═══════════════════════
          Editorial wordmark + live local time. Sits above the hero
          to set the "field journal" register before the imagery hits. */}
      <header
        className="wa-reveal"
        style={{
          padding: "14px 20px 12px",
          background: "#1A2E1F",
          borderBottom: "1px solid rgba(201,169,110,0.28)",
          ["--d" as any]: "0ms",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic", fontWeight: 500, fontSize: 18,
                color: "#E8D9B5", letterSpacing: "-0.01em", lineHeight: 1,
              }}
            >
              WildAtlas
            </span>
            <span
              aria-hidden="true"
              style={{ width: 14, height: 1, background: "rgba(201,169,110,0.55)" }}
            />
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 9, fontWeight: 600, letterSpacing: "0.22em",
                color: "rgba(232,217,181,0.7)", textTransform: "uppercase",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              Field Edition · Vol. 01
            </span>
          </div>
          <button
            onClick={handleShare}
            aria-label="Share WildAtlas"
            style={{
              background: "none", border: "none", padding: 8,
              minHeight: 44, minWidth: 44,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Share2 size={16} strokeWidth={1.5} color="#E8D9B5" />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 9, fontWeight: 600, letterSpacing: "0.18em",
              color: "rgba(232,217,181,0.55)", textTransform: "uppercase",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {localTime.weekday} · {localTime.dateLabel} · {coords}
          </span>
          <span
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic", fontSize: 13,
              color: "#E8D9B5", letterSpacing: "0.01em",
            }}
          >
            {localTimeLabel}
            <span className="wa-caret" aria-hidden="true" style={{
              display: "inline-block", width: 5, height: 12, marginLeft: 3,
              background: "rgba(232,217,181,0.7)", verticalAlign: "middle",
            }} />
          </span>
        </div>
      </header>

      {/* ═══════════════════════ II. CINEMATIC HERO ═══════════════════════
          Full-bleed park imagery with extended ken-burns reveal, soft
          vignette breath, time-of-day color grading, oversized italic
          headline, and an editorial gold rule above the title. */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: "clamp(440px, 64vh, 560px)",
          aspectRatio: "16 / 11",
          contain: "layout paint",
        }}
      >
        {!heroImgError && (
          <img
            ref={heroImgRef}
            src={hero.image}
            alt={hero.alt}
            width={1600}
            height={1100}
            decoding="async"
            onLoad={() => setHeroImgLoaded(true)}
            onError={() => { setHeroImgError(true); setHeroImgLoaded(true); }}
            className={heroImgLoaded ? "wa-hero-img absolute inset-0 w-full h-full object-cover" : "absolute inset-0 w-full h-full object-cover"}
            style={{
              objectPosition: hero.objectPosition ?? "center 30%",
              filter: photoFilter,
              transition: "filter 1200ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)",
              opacity: heroImgLoaded ? 1 : 0,
            }}
          />
        )}
        {!heroImgLoaded && !heroImgError && (
          <div
            aria-hidden="true"
            className="permit-skeleton-shimmer absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${parkConfig.primaryColor ?? "#2F6F4E"}33 0%, #1A2F1E 100%)`,
              zIndex: 0,
            }}
          />
        )}
        {heroImgError && (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: `radial-gradient(120% 80% at 50% 110%, ${parkConfig.primaryColor ?? "#2F6F4E"} 0%, #1A2F1E 70%, #0E1A11 100%)`,
              zIndex: 0,
            }}
          >
            <svg viewBox="0 0 600 240" preserveAspectRatio="xMidYMax slice" className="absolute bottom-0 left-0 w-full" style={{ height: "60%", opacity: 0.22 }}>
              <path d="M0 240 L0 180 L120 90 L200 150 L300 60 L400 140 L520 70 L600 130 L600 240 Z" fill="#0B1A11" />
              <path d="M0 240 L0 210 L80 160 L180 200 L280 140 L360 195 L460 150 L600 200 L600 240 Z" fill="#000" opacity="0.45" />
            </svg>
          </div>
        )}
        {/* Tap-to-zoom: invisible button covers the photo, sits below editorial overlays */}
        {!heroImgError && (
          <button
            type="button"
            aria-label={`View larger image of ${parkConfig.shortName}`}
            onClick={openLightbox}
            disabled={!heroImgLoaded}
            style={{
              position: "absolute", inset: 0, zIndex: 3,
              background: "transparent", border: "none", padding: 0, margin: 0,
              cursor: heroImgLoaded ? "zoom-in" : "default",
              WebkitTapHighlightColor: "transparent",
            }}
          />
        )}
        {/* Time-of-day overlay (live) */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: photoOverlay, zIndex: 1, transition: "background 1200ms cubic-bezier(0.4, 0, 0.2, 1)" }} />
        {/* Universal photo scrim — readability for type at the bottom */}
        <div className="park-photo-scrim wa-hero-vignette pointer-events-none" />
        {/* Park-tinted bottom wash */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `linear-gradient(to top, ${parkConfig.primaryColor ?? "#2F6F4E"}b8 0%, ${parkConfig.primaryColor ?? "#2F6F4E"}26 38%, transparent 68%)`,
          zIndex: 2,
        }} />

        {/* Top eyebrow — FIELD REPORT cluster */}
        <div className="absolute top-5 left-5 right-5 wa-reveal" style={{ zIndex: 10, ["--d" as any]: "260ms" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ height: 1, width: 22, background: "#E8D9B5", flexShrink: 0 }} />
            <span style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.22em", color: "rgba(255,255,255,0.92)",
              textTransform: "uppercase", textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              Field Report
            </span>
          </div>
        </div>

        {/* Bottom editorial title stack — oversized italic */}
        <div className="absolute left-5 right-5 wa-reveal" style={{ bottom: 24, zIndex: 10, ["--d" as any]: "440ms" }}>
          {/* Tiny gold rule above title */}
          <span className="wa-rule-solid" style={{ width: 36, marginBottom: 12, background: "#E8D9B5", ["--d" as any]: "560ms" }} />
          {(() => {
            const heroText = parkConfig.shortName;
            // Generous scale for solo park names; clamp gracefully.
            const heroFontSize = heroText.length <= 12 ? 56 : heroText.length <= 18 ? 46 : heroText.length <= 24 ? 38 : 30;
            return (
              <h1 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: heroFontSize, fontStyle: "italic",
                fontWeight: 400, letterSpacing: "-0.025em",
                color: "#FFFFFF", lineHeight: 0.98,
                textShadow: "0 2px 14px rgba(0,0,0,0.55)",
                margin: "8px 0 0", wordBreak: "break-word",
              }}>
                {heroText}
              </h1>
            );
          })()}
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, fontWeight: 400,
            color: "rgba(255,255,255,0.86)",
            margin: "10px 0 0", letterSpacing: "0.005em",
            lineHeight: 1.45, maxWidth: 320,
            textShadow: "0 1px 8px rgba(0,0,0,0.45)",
          }}>
            {parkConfig.heroDescription}
          </p>
          {/* Live forecast pill or shimmer placeholder */}
          {heroForecast ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7, maxWidth: "100%",
              background: badgeBg(parkConfig.primaryColor),
              backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: "0.5px solid rgba(255,255,255,0.22)",
              borderRadius: 999, padding: "5px 13px", marginTop: 14,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: heroForecast.status === "Busy" ? "var(--wa-crowd-busy)"
                  : heroForecast.status === "Building" ? "var(--wa-crowd-building)"
                  : heroForecast.status === "Packed" ? "var(--wa-crowd-packed)"
                  : "var(--wa-crowd-quiet)",
              }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {heroForecast.location} · {heroForecast.status} now{heroForecast.quietsAfter ? ` · quiets after ${heroForecast.quietsAfter}` : ""}
              </span>
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="permit-skeleton-shimmer"
              style={{
                width: 200, height: 24, borderRadius: 999, marginTop: 14,
                background: "rgba(255,255,255,0.10)",
                border: "0.5px solid rgba(255,255,255,0.12)",
              }}
            />
          )}
        </div>
      </div>

      {/* Cinematic in-page lightbox for the hero photo */}
      <HeroLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        src={hero.image}
        alt={hero.alt}
        eyebrow="Field Report"
        title={parkConfig.shortName}
        subtitle={parkConfig.heroDescription}
        originRect={lightboxOrigin}
        objectPosition={hero.objectPosition ?? "center 30%"}
      />

      {/* ═══════════════════════ III. PARK SELECTOR STRIP ═══════════════════════
          Sticky just under the hero, on a near-black ribbon so the choice
          feels deliberate (not a header tab). */}
      <div
        className="wa-reveal"
        style={{
          background: "#1A2E1F",
          borderBottom: "1px solid rgba(201,169,110,0.32)",
          padding: "12px 20px",
          ["--d" as any]: "200ms",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <ParkSelector
            activeParkId={parkId}
            onParkChange={stableParkChange}
            variant="overlay"
            watchedParkIds={watchedParkIds}
          />
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600,
            letterSpacing: "0.22em", color: "rgba(232,217,181,0.55)",
            textTransform: "uppercase",
          }}>
            Change park ⌄
          </span>
        </div>
      </div>

      {/* ═══════════════════════ IV. TELEMETRY STRIP ═══════════════════════
          Sun ephemeris in editorial cells with hairlines. */}
      <motion.div
        key={parkId}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        style={{
          background: "#1A2F1E",
          borderBottom: "1px solid rgba(201,169,110,0.18)",
          padding: "14px 12px",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", alignItems: "center" }}>
          {[
            { eyebrow: "Local", value: localTimeLabel, dim: false },
            { eyebrow: countdownEyebrow, value: countdownValue, dim: false },
            { eyebrow: "Sunrise", value: sunriseLabel, dim: true },
            { eyebrow: "Sunset", value: sunsetLabel, dim: true },
          ].map((c, i) => (
            <div key={c.eyebrow} style={{
              textAlign: "center", padding: "0 4px", minWidth: 0,
              borderLeft: i === 0 ? "none" : "1px solid rgba(201,169,110,0.18)",
            }}>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600,
                letterSpacing: "0.18em", textTransform: "uppercase",
                color: c.dim ? "rgba(232,217,181,0.45)" : "rgba(232,217,181,0.78)",
                margin: 0, marginBottom: 4,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{c.eyebrow}</p>
              <p style={{
                fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                fontSize: c.dim ? 14 : 17, fontWeight: 400,
                color: c.dim ? "rgba(240,237,234,0.78)" : "#F0EDEA",
                letterSpacing: "-0.005em", margin: 0, lineHeight: 1.1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{c.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ═══════════════════════ LIVE ALERT (preserved) ═══════════════════════ */}
      <AnimatePresence initial={false}>
        {liveAlertSnapshot && (
          <motion.div
            key={`live-alert-${liveAlertSnapshot.eventType}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
            }}
            style={{ overflow: "hidden" }}
          >
            <LiveAlertBanner
              eventType={liveAlertSnapshot.eventType}
              mins={liveAlertSnapshot.mins}
              eventLabel={liveAlertSnapshot.eventLabel}
              tips={data?.tips ?? null}
              seasonLabel={data?.label ?? activeSeason}
              fallbackTips={(() => {
                if (!seasonContent) return [];
                const out: any[] = [];
                const seen = new Set<string>();
                const MAX = 3;
                for (const s of seasons) {
                  if (s === activeSeason) continue;
                  const sd = seasonContent[s];
                  for (const tip of sd?.tips ?? []) {
                    const key = String(tip?.id ?? tip?.title ?? "").trim();
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    out.push({ ...tip, _seasonLabel: sd.label });
                    if (out.length >= MAX) break;
                  }
                  if (out.length >= MAX) break;
                }
                return out;
              })()}
              expanded={liveAlertExpanded}
              onToggle={() => setLiveAlertExpanded((v) => !v)}
              onTipClick={handleTipNavigate}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════ FIELD-LOG STRIP (recent finds) ═══════════════════════ */}
      {!findsLoading && recentFinds > 0 && (
        <div
          className="wa-reveal"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(47,111,78,0.08)",
            padding: "12px 20px",
            borderBottom: "1px solid rgba(201,169,110,0.28)",
            minWidth: 0, ["--d" as any]: "120ms",
          }}
        >
          <span style={{ height: 1, width: 14, background: "#C9A96E", flexShrink: 0 }} />
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.18em", color: "#2F6F4E", textTransform: "uppercase",
            flexShrink: 0,
          }}>
            Logged
          </span>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
            fontSize: 14, color: "#1A2E1F", flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {recentFinds} permit{recentFinds > 1 ? "s" : ""} found · last {timeWindow}
          </span>
          <button
            onClick={() => onNavigateToSniper?.()}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
              color: "#2F6F4E", background: "none", border: "none", cursor: "pointer",
              padding: 0, whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            View →
          </button>
        </div>
      )}

      {/* ═══════════════════════ V. EDITORIAL INTRO — POKO'S READ ═══════════════════════
          Pure data still flows from PokoReadCard child (preserves caching,
          streaming animation, edge-function call). We frame it with a plate. */}
      <RevealSection style={{ padding: "32px 20px 4px" }}>
        <SectionPlate
          numeral="I"
          eyebrow="Today's read"
          italic={`Poko's brief from ${parkConfig.shortName}`}
          delay={80}
        />
        <div style={{ marginInline: -20 }}>
          {/* PokoReadCard handles its own padding; passing through unchanged */}
          <PokoReadCard
            parkId={parkId}
            parkShortName={parkConfig.shortName}
            onAskPoko={onNavigateToMochi}
          />
        </div>
      </RevealSection>

      {/* ═══════════════════════ VI. FIELD LOG (live signals) ═══════════════════════ */}
      <RevealSection style={{ padding: "30px 20px 4px" }} delay={60}>
        <SectionPlate
          numeral="II"
          eyebrow="Field log"
          italic="Live signals from the trail"
          delay={120}
        />
        <div style={{ marginInline: -20 }}>
          <FieldLog parkId={parkId} onNavigateToSniper={onNavigateToSniper} />
        </div>
      </RevealSection>

      {/* ═══════════════════════ VII. TODAY IN PARK (dark plate) ═══════════════════════ */}
      <RevealSection
        style={{
          marginTop: 32,
          background: "linear-gradient(180deg, #1A2F1E 0%, #142519 100%)",
          padding: "26px 20px 28px",
          borderTop: "1px solid rgba(201,169,110,0.32)",
          borderBottom: "1px solid rgba(201,169,110,0.18)",
        }}
      >
        <SectionPlate
          numeral="III"
          eyebrow={`Today · ${localTime.weekday}`}
          italic="What the patterns say about right now"
          dark
          delay={0}
        />
        <TypicalPatternsHeader />
        <TodayParkAdvice parkId={parkId} darkMode />
      </RevealSection>

      {/* ═══════════════════════ VIII. PLAN AHEAD — CROWD WINDOWS ═══════════════════════ */}
      <section style={{ padding: "32px 20px 4px" }}>
        <SectionPlate
          numeral="IV"
          eyebrow="Plan ahead"
          italic="Crowd patterns by season — typical, not live"
          delay={60}
        />
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid rgba(201,169,110,0.18)" }}>
          <CrowdWindows parkId={parkId} season={activeSeason}>
            <div className="flex bg-muted rounded-[10px] p-1 gap-1 mb-3">
              {seasons.map((s) => {
                const SeasonIcon = seasonContent[s].icon;
                const isActive = s === activeSeason;
                return (
                  <button
                    key={s}
                    onClick={() => setActiveSeason(s)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[6px] text-xs font-semibold transition-all duration-200 ${
                      isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isActive && <div className="absolute inset-0 bg-primary rounded-md shadow-sm" />}
                    <span className="relative flex items-center gap-1.5">
                      <SeasonIcon size={13} />
                      {seasonContent[s].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CrowdWindows>
        </div>
      </section>

      {/* ═══════════════════════ IX. PLAN YOUR VISIT ═══════════════════════ */}
      <section style={{ padding: "32px 20px 4px" }}>
        <SectionPlate
          numeral="V"
          eyebrow="Your trip"
          italic={arrivalDate ? `Set for ${format(arrivalDate, "MMMM d")}` : "Add a date for a tailored brief"}
          delay={60}
        />
        {arrivalDate && daysUntilTrip !== null ? (
          <>
            <div style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(201,169,110,0.18)" }}>
              <div style={{ padding: "20px 20px 16px", borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "#6B6860", marginBottom: 12,
                }}>Upcoming Trip</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                      fontSize: 26, fontWeight: 400, color: "#1C1C1A",
                      lineHeight: 1.1, letterSpacing: "-0.015em", margin: 0,
                    }}>
                      {parkConfig.shortName}
                    </p>
                    <p style={{ fontSize: 12, color: "#6B6860", marginTop: 8, margin: 0 }}>
                      {format(arrivalDate, "MMMM d, yyyy")}
                      <button
                        onClick={() => setTripModalOpen(true)}
                        style={{ fontSize: 12, fontWeight: 500, color: "#2F6F4E", background: "transparent", padding: 0, border: "none", cursor: "pointer", marginLeft: 6 }}
                      >
                        · Edit
                      </button>
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{
                      fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                      fontSize: 38, fontWeight: 500, color: "#2F6F4E",
                      lineHeight: 0.95, margin: 0, letterSpacing: "-0.02em",
                    }}>
                      {daysUntilTrip <= 0 ? (daysUntilTrip === 0 ? "0" : "✓") : daysUntilTrip}
                    </p>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 700,
                      letterSpacing: "0.18em", color: "#6B6860", marginTop: 4,
                      textTransform: "uppercase",
                    }}>
                      {daysUntilTrip <= 0 ? (daysUntilTrip === 0 ? "Today" : "You're there") : "Days left"}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ padding: "4px 0" }}>
                <button
                  onClick={() => onNavigateToSniper?.()}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", width: "100%", background: "none", border: "none", borderBottom: "0.5px solid rgba(0,0,0,0.06)", cursor: "pointer", textAlign: "left", minHeight: 44 }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F5F2EE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <CalendarIcon size={16} style={{ color: "#2F6F4E" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#1C1C1A", margin: 0 }}>Permit availability</p>
                    <p style={{ fontSize: 11, color: "#6B6860", margin: 0, marginTop: 2 }}>Check open dates around {format(arrivalDate, "MMM d")}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#2F6F4E", whiteSpace: "nowrap" }}>Check →</span>
                </button>
                <a
                  href={`https://www.nps.gov/${parkConfig.npsCode || parkId}/planyourvisit/weather.htm`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", width: "100%", textDecoration: "none", minHeight: 44 }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F5F2EE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Sun size={16} style={{ color: "#2F6F4E" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#1C1C1A", margin: 0 }}>{format(arrivalDate, "MMM d")} forecast</p>
                    <p style={{ fontSize: 11, color: "#6B6860", margin: 0, marginTop: 2 }}>NPS weather · {parkConfig.region}</p>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#2F6F4E", whiteSpace: "nowrap" }}>View →</span>
                </a>
              </div>
            </div>

            <button
              onClick={() => onNavigateToMochi?.(`What should I know for my ${parkConfig.shortName} trip on ${format(arrivalDate, "MMM d")}?`)}
              className="hover:brightness-95 active:scale-[0.98] transition-all"
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
                width: "100%", background: "#1A2E1F", border: "1px solid rgba(201,169,110,0.42)",
                borderRadius: 14, cursor: "pointer", textAlign: "left", marginTop: 10, minHeight: 44,
              }}
            >
              <img src="/mochi-map.png" alt="Poko" style={{ width: 32, height: 32, flexShrink: 0, objectFit: "contain" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                  fontSize: 16, color: "#E8D9B5", margin: 0, letterSpacing: "-0.005em",
                }}>
                  Get Poko's trip briefing
                </p>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 400,
                  color: "rgba(232,217,181,0.7)", margin: "2px 0 0",
                }}>
                  What to know for {parkConfig.shortName} on {format(arrivalDate, "MMM d")}
                </p>
              </div>
              <ChevronRight size={16} style={{ color: "rgba(232,217,181,0.7)", flexShrink: 0 }} />
            </button>
          </>
        ) : (
          <div style={{
            background: "#FFFFFF",
            border: "1px solid rgba(201,169,110,0.32)",
            borderRadius: 14, padding: "26px 20px", textAlign: "center",
          }}>
            <CalendarIcon size={26} strokeWidth={1.5} style={{ color: "#C9A96E", margin: "0 auto 12px" }} />
            <p style={{
              fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
              fontSize: 22, fontWeight: 400, color: "#1A2E1F", margin: 0,
              letterSpacing: "-0.01em",
            }}>
              Planning a trip?
            </p>
            <p style={{ fontSize: 13, color: "#6B6860", lineHeight: 1.6, margin: "8px 0 18px" }}>
              Add your target date and Poko will brief you on what to expect — permits, crowds, and conditions.
            </p>
            <button
              onClick={() => setTripModalOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", background: "#1A2E1F",
                color: "#E8D9B5", fontFamily: "'DM Sans', sans-serif",
                fontSize: 12, fontWeight: 600, letterSpacing: "0.12em",
                textTransform: "uppercase", padding: "12px 22px",
                borderRadius: 999, border: "1px solid rgba(201,169,110,0.42)",
                cursor: "pointer", minHeight: 44,
              }}
            >
              + Add trip date
            </button>
          </div>
        )}
      </section>

      {/* ═══════════════════════ X. SEASONAL INSIGHT — gallery plate ═══════════════════════ */}
      <RevealSection style={{ padding: "36px 20px 4px" }}>
        <SectionPlate
          numeral="VI"
          eyebrow={`${data.label} · in residence`}
          italic="A short essay on the season at hand"
          delay={60}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`mochi-${parkId}-${activeSeason}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
            style={{
              background: "#FAF7F2",
              border: "1px solid rgba(201,169,110,0.22)",
              borderLeft: "3px solid #1A2E1F",
              borderRadius: 10,
              padding: "26px 24px 22px",
              position: "relative",
            }}
          >
            <h3 style={{
              fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
              fontSize: 32, fontWeight: 400, color: "#1A2E1F",
              letterSpacing: "-0.02em", lineHeight: 1.05,
              marginBottom: 16, margin: 0,
            }}>
              {data.label} in {parkConfig.shortName}
            </h3>
            <span className="wa-rule-solid" style={{ width: 28, marginBlock: "12px 18px", background: "rgba(201,169,110,0.6)" }} />
            <SeasonalBlurb body={data.mochiTip.body ?? ""} />
            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", marginTop: 22, marginBottom: 14 }} />
            <button
              onClick={() => onNavigateToMochi?.(`Tell me Poko's pick for ${data.label.toLowerCase()} in ${parkConfig.shortName}`)}
              style={{
                fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                fontSize: 14, color: "#C9A96E", background: "none", border: "none",
                cursor: "pointer", padding: 0, textDecoration: "underline",
                textUnderlineOffset: 4, textDecorationColor: "rgba(201,169,110,0.4)",
              }}
            >
              Poko's pick for {data.label.toLowerCase()} →
            </button>
          </motion.div>
        </AnimatePresence>
      </RevealSection>

      {/* ═══════════════════════ XI. LOCAL KNOWLEDGE — paired plates ═══════════════════════ */}
      <RevealSection style={{ padding: "36px 20px 4px" }} delay={60}>
        <SectionPlate
          numeral="VII"
          eyebrow="Local knowledge"
          italic="Four notes the rangers want you to know"
          delay={60}
        />
        <div className="grid grid-cols-2" style={{ gap: 10 }}>
          {cardsSettling
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`hl-skel-${i}`}
                  className="wa-highlight-card content-crossfade"
                  aria-hidden="true"
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid rgba(201,169,110,0.18)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    borderRadius: 10,
                    padding: 16,
                    minHeight: 148,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Shimmer wash mirroring the .permit-skeleton-shimmer system */}
                  <span className="permit-skeleton-shimmer" style={{
                    position: "absolute", inset: 0, borderRadius: 10,
                    background: "linear-gradient(135deg, rgba(201,169,110,0.06) 0%, rgba(245,240,232,0.55) 100%)",
                  }} />
                  {/* Skeleton stand-ins matching the real layout's rhythm */}
                  <span style={{
                    width: 14, height: 14, borderRadius: 3, marginBottom: 10,
                    background: "rgba(47,111,78,0.14)", flexShrink: 0,
                  }} />
                  <span style={{
                    width: "62%", height: 8, borderRadius: 999, marginBottom: 10,
                    background: "rgba(107,104,96,0.18)",
                  }} />
                  <span style={{
                    width: "100%", height: 8, borderRadius: 999, marginBottom: 6,
                    background: "rgba(26,46,31,0.10)",
                  }} />
                  <span style={{
                    width: "88%", height: 8, borderRadius: 999, marginBottom: 6,
                    background: "rgba(26,46,31,0.10)",
                  }} />
                  <span style={{
                    width: "54%", height: 8, borderRadius: 999,
                    background: "rgba(26,46,31,0.10)",
                  }} />
                </div>
              ))
            : (parkHighlights[parkId] ?? []).map((card, i) => {
            const CardIcon = card.icon;
            return (
              <motion.div
                key={`${parkId}-${card.title}`}
                className="wa-highlight-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: 0.06 * i }}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid rgba(201,169,110,0.18)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  borderRadius: 10,
                  padding: 16,
                  minHeight: 148,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  position: "relative",
                }}
              >
                {/* Roman numeral marker top-right */}
                <span aria-hidden="true" style={{
                  position: "absolute", top: 10, right: 12,
                  fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                  fontSize: 11, color: "#C9A96E", letterSpacing: "0.04em",
                }}>
                  {ROMAN[i]}
                </span>
                <CardIcon size={14} strokeWidth={1.6} style={{ color: "#2F6F4E", marginBottom: 10 }} />
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.18em", color: "#6B6860",
                  textTransform: "uppercase", margin: "0 0 6px",
                }}>
                  {card.title}
                </p>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400,
                  color: "#1A2E1F", lineHeight: 1.55, margin: 0,
                  display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>
                  {card.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </RevealSection>

      {/* ═══════════════════════ XII. RANGER NOTES — clustered chronicle ═══════════════════════ */}
      <RevealSection style={{ padding: "36px 20px 4px" }}>
        <SectionPlate
          numeral="VIII"
          eyebrow={`Ranger notes · ${data.label}`}
          italic="Field-verified guidance, grouped by what you'll meet first"
          delay={60}
        />

        {cardsSettling ? (
          // Skeleton chronicle — two cluster headers + four tip rows that
          // mirror the real layout's silhouette so there's no visual jump.
          <>
            {Array.from({ length: 2 }).map((_, ci) => (
              <div key={`tip-skel-cluster-${ci}`} className="content-crossfade" aria-hidden="true">
                <div className="wa-cluster-head" style={{ opacity: 0.6 }}>
                  <span aria-hidden="true" className="wa-cluster-pip" />
                  <span className="wa-cluster-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 80, height: 7, borderRadius: 999,
                      background: "rgba(107,104,96,0.22)",
                    }} />
                    <span style={{
                      width: 18, height: 7, borderRadius: 999,
                      background: "rgba(201,169,110,0.32)",
                    }} />
                  </span>
                  <span aria-hidden="true" className="wa-cluster-rule" />
                </div>
                {Array.from({ length: 2 }).map((__, j) => (
                  <div
                    key={`tip-skel-${ci}-${j}`}
                    className="wa-rich-tip permit-skeleton-shimmer"
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      minHeight: 96,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <span className="wa-tip-icon-frame" style={{
                        background: "rgba(47,111,78,0.10)",
                        borderColor: "rgba(201,169,110,0.18)",
                      }} />
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                        <span style={{
                          display: "block", width: "70%", height: 10, borderRadius: 999,
                          background: "rgba(26,46,31,0.14)", marginBottom: 10,
                        }} />
                        <span style={{
                          display: "block", width: "100%", height: 8, borderRadius: 999,
                          background: "rgba(26,46,31,0.08)", marginBottom: 6,
                        }} />
                        <span style={{
                          display: "block", width: "82%", height: 8, borderRadius: 999,
                          background: "rgba(26,46,31,0.08)",
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        ) : tipClusters.map((cluster, ci) => {
          const isCollapsed = collapsedClusters.has(cluster.theme);
          const panelId = `cluster-panel-${cluster.theme}`;
          const headerId = `cluster-head-${cluster.theme}`;
          return (
          <div key={cluster.theme}>
            <button
              type="button"
              id={headerId}
              className="wa-cluster-head wa-cluster-head-toggle"
              onClick={() => toggleCluster(cluster.theme)}
              aria-expanded={!isCollapsed}
              aria-controls={panelId}
              aria-label={`${cluster.label}, ${cluster.tips.length} ${cluster.tips.length === 1 ? "note" : "notes"}. ${isCollapsed ? "Expand" : "Collapse"}.`}
            >
              <span aria-hidden="true" className="wa-cluster-pip" />
              <span className="wa-cluster-eyebrow">
                {cluster.label}
                <span aria-hidden="true" className="wa-cluster-count">
                  {String(cluster.tips.length).padStart(2, "0")}
                </span>
              </span>
              <span aria-hidden="true" className="wa-cluster-rule" />
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="wa-cluster-chevron"
                style={{
                  color: "#C9A96E",
                  flexShrink: 0,
                  marginLeft: 8,
                  transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                }}
              />
            </button>

            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  key={panelId}
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
                  }}
                  style={{ overflow: "hidden" }}
                >
                  {cluster.tips.map(({ tip, idx }, j) => {
              const Icon = tip.icon;
              const signals = Array.isArray(tip.signals) ? tip.signals.slice(0, 2) : [];
              return (
                <motion.article
                  key={tip.id}
                  id={`tip-${tip.id}`}
                  className="wa-rich-tip"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.36,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.04 * ci + 0.05 * j,
                  }}
                  aria-labelledby={`tip-${tip.id}-title`}
                >
                  {/* Header row: icon-in-frame + title + roman index */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                    <span aria-hidden="true" className="wa-tip-icon-frame">
                      <Icon size={15} strokeWidth={1.6} style={{ color: "#2F6F4E" }} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <button
                        type="button"
                        id={`tip-${tip.id}-title`}
                        onClick={() => copyTipLink(tip.id)}
                        title="Copy link to this tip"
                        aria-label={`${tip.title} — copy share link`}
                        className="wa-rich-tip-title"
                        style={{
                          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                          fontWeight: 500, fontSize: 19, color: "#1A2E1F",
                          lineHeight: 1.2, letterSpacing: "-0.005em",
                          margin: 0, paddingRight: 24,
                          background: "none", border: "none", padding: 0,
                          textAlign: "left", cursor: "pointer", display: "inline",
                          font: "inherit",
                        }}
                      >
                        {tip.title}
                      </button>
                    </div>
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute", top: 12, right: 14,
                        fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                        fontSize: 12, color: "#C9A96E", letterSpacing: "0.04em",
                        lineHeight: 1,
                      }}
                    >
                      {ROMAN[idx]}
                    </span>
                  </div>

                  {/* Body */}
                  <p style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 400,
                    color: "#3D3D3A", lineHeight: 1.6, margin: 0,
                    paddingLeft: 44,
                  }}>
                    {tip.body}
                  </p>

                  {/* Signal chips — quick-scan facts pulled from tip.signals */}
                  {signals.length > 0 && (
                    <div style={{
                      display: "flex", flexWrap: "wrap", gap: 8,
                      marginTop: 12, paddingLeft: 44,
                    }}>
                      {signals.map((sig: any, si: number) => (
                        <span key={si} className="wa-signal-chip">
                          <span className="wa-signal-chip-label">{sig.label}</span>
                          <span className="wa-signal-chip-value">{sig.value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </motion.article>
              );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          );
        })}

        {/* ── From other seasons — elegant collapsed drawer ── */}
        {crossSeasonTips.length > 0 && (
          <div className="wa-cross-season">
            <button
              type="button"
              className="wa-cross-season-trigger"
              onClick={() => setCrossSeasonOpen((v) => !v)}
              aria-expanded={crossSeasonOpen}
              aria-controls="cross-season-list"
            >
              <span aria-hidden="true" style={{ width: 14, height: 1, background: "#C9A96E", flexShrink: 0 }} />
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.18em", color: "#6B6860", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>
                Year-round notes · {String(crossSeasonTips.length).padStart(2, "0")}
              </span>
              <span aria-hidden="true" className="wa-cross-season-rule" />
              <motion.span
                animate={{ rotate: crossSeasonOpen ? 90 : 0 }}
                transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                style={{ display: "inline-flex", color: "#C9A96E", flexShrink: 0 }}
                aria-hidden="true"
              >
                <ChevronRight size={14} />
              </motion.span>
            </button>

            {!crossSeasonOpen && (
              <p style={{
                fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                fontSize: 14, color: "#6B6860", margin: "2px 0 0 24px",
                lineHeight: 1.4,
              }}>
                A few notes from other seasons that still apply.
              </p>
            )}

            <AnimatePresence initial={false}>
              {crossSeasonOpen && (
                <motion.ul
                  id="cross-season-list"
                  key="cross-season-list"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
                    opacity: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
                  }}
                  style={{
                    listStyle: "none", padding: 0, margin: "14px 0 0",
                    overflow: "hidden",
                  }}
                >
                  {crossSeasonTips.map((tip: any, i: number) => {
                    const Icon = tip.icon;
                    return (
                      <motion.li
                        key={tip._seasonKey + ":" + (tip?.id ?? i)}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1], delay: 0.05 * i }}
                        style={{
                          display: "flex", gap: 12, alignItems: "flex-start",
                          padding: "12px 4px",
                          borderTop: i === 0 ? "none" : "1px solid rgba(201,169,110,0.16)",
                        }}
                      >
                        <span aria-hidden="true" className="wa-tip-icon-frame" style={{ width: 28, height: 28 }}>
                          <Icon size={13} strokeWidth={1.6} style={{ color: "#2F6F4E" }} />
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                            <p style={{
                              fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
                              fontWeight: 500, fontSize: 16, color: "#1A2E1F",
                              lineHeight: 1.2, margin: 0,
                            }}>
                              {tip.title}
                            </p>
                            <span className="wa-season-badge">{tip._seasonLabel}</span>
                          </div>
                          {tip.body && (
                            <p style={{
                              fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 400,
                              color: "#5A574F", lineHeight: 1.55, margin: 0,
                            }}>
                              {tip.body}
                            </p>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </RevealSection>

      {/* ═══════════════════════ XIII. COLOPHON ═══════════════════════ */}
      <footer style={{ padding: "44px 20px 36px", textAlign: "center" }}>
        <span className="wa-rule-solid" style={{ width: 60, marginInline: "auto", display: "block", background: "rgba(201,169,110,0.55)" }} />
        <p style={{
          fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
          fontSize: 15, color: "#1A2E1F", margin: "16px 0 6px",
          letterSpacing: "0.005em",
        }}>
          WildAtlas · Field Edition
        </p>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 500,
          letterSpacing: "0.22em", color: "#6B6860",
          textTransform: "uppercase", margin: 0,
        }}>
          Compiled for {parkConfig.shortName} · {localTime.dateLabel}
        </p>
        <div style={{
          marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <Radar size={10} style={{ color: "#6B6860" }} />
          <span style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500,
            color: "#6B6860",
          }}>
            Permit scanner active in Alerts
          </span>
        </div>
      </footer>

      <TripDateModal
        open={tripModalOpen}
        onClose={() => setTripModalOpen(false)}
        onSave={handleTripModalSave}
        onRemove={handleTripRemove}
        initialParkId={parkId}
        initialDate={arrivalDate}
        isEditMode={!!arrivalDate}
      />
    </div>
  );
});

DiscoverTips.displayName = "DiscoverTips";

/* ═════════════════════════════════════════════════════════════════
   LiveAlertBanner — preserved verbatim from previous implementation.
   Carries skeletons, severity tiers, fallback-tip toggle, focus mgmt,
   live-region announcements, and reduced-motion guards.
   ═════════════════════════════════════════════════════════════════ */

const SKELETON_TONES = {
  strong: "rgba(201,169,110,0.18)",
  muted: "rgba(201,169,110,0.14)",
} as const;

const SKELETON_SIZES = {
  xs: { height: 8, radius: 2 },
  sm: { height: 12, radius: 2 },
  md: { height: 14, radius: 3 },
  row: { height: 44, radius: 8 },
} as const;

type LiveAlertSkeletonProps = {
  size?: keyof typeof SKELETON_SIZES;
  tone?: keyof typeof SKELETON_TONES;
  width?: number | string;
  style?: React.CSSProperties;
};

const LiveAlertSkeleton = ({
  size = "sm", tone = "muted", width = "100%", style,
}: LiveAlertSkeletonProps) => {
  const { height, radius } = SKELETON_SIZES[size];
  return (
    <div
      className="permit-skeleton-shimmer"
      style={{
        height, width, borderRadius: radius,
        background: SKELETON_TONES[tone],
        ...style,
      }}
    />
  );
};

type LiveAlertBannerProps = {
  eventType: "sunrise" | "sunset";
  mins: number;
  eventLabel: string;
  tips: any[] | null;
  seasonLabel: string;
  fallbackTips?: any[];
  expanded: boolean;
  onToggle: () => void;
  onTipClick?: (tipId: string) => void;
};

const LiveAlertBannerInner = ({
  eventType, mins, eventLabel, tips, seasonLabel, fallbackTips = [],
  expanded, onToggle, onTipClick,
}: LiveAlertBannerProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const userToggledRef = useRef(false);
  const prevExpandedRef = useRef(expanded);

  const handleToggle = useCallback(() => {
    userToggledRef.current = true;
    onToggle();
  }, [onToggle]);

  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape" && expanded) {
      e.preventDefault();
      userToggledRef.current = true;
      onToggle();
    }
  }, [expanded, onToggle]);

  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && expanded) {
      e.preventDefault();
      e.stopPropagation();
      userToggledRef.current = true;
      onToggle();
    }
  }, [expanded, onToggle]);

  useEffect(() => {
    const wasExpanded = prevExpandedRef.current;
    prevExpandedRef.current = expanded;
    if (!userToggledRef.current) return;
    if (expanded && !wasExpanded) {
      const id = window.setTimeout(() => panelRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
    if (!expanded && wasExpanded) triggerRef.current?.focus();
    userToggledRef.current = false;
  }, [expanded]);

  const isSunrise = eventType === "sunrise";
  const m = eventLabel.match(/^(\d{1,2}):(\d{2})([ap])$/i);
  const eventTimeLabel = m ? `${m[1]}:${m[2]} ${m[3].toUpperCase()}M` : eventLabel;
  const countdown = formatCountdown(mins);
  const headline = isSunrise
    ? mins <= 5 ? "Sunrise now" : `Sunrise in ${countdown}`
    : mins <= 5 ? "Sunset now" : `Sunset in ${countdown}`;
  const subtext = isSunrise
    ? `First light at ${eventTimeLabel} · low-angle glare on east-facing trails`
    : `Last light at ${eventTimeLabel} · headlamp recommended within the hour`;
  const Icon = isSunrise ? Sunrise : Sun;

  const severity: "subtle" | "elevated" | "imminent" =
    mins < 5 ? "imminent" : mins <= 10 ? "elevated" : "subtle";

  const tier = {
    subtle: {
      bg: "rgba(201,169,110,0.10)",
      borderBottom: "1px solid rgba(201,169,110,0.30)",
      eyebrow: "#C9A96E",
      subtext: "var(--wa-ink-subtle)",
      icon: "#C9A96E",
      chevron: "#C9A96E",
      eyebrowWeight: 600 as const,
      pulse: false,
    },
    elevated: {
      bg: "rgba(201,169,110,0.18)",
      borderBottom: "2px solid rgba(201,169,110,0.55)",
      eyebrow: "#B8924A",
      subtext: "var(--wa-ink-primary)",
      icon: "#B8924A",
      chevron: "#B8924A",
      eyebrowWeight: 700 as const,
      pulse: false,
    },
    imminent: {
      bg: "#1A2F1E",
      borderBottom: "2px solid #C9A96E",
      eyebrow: "#E8D9B5",
      subtext: "rgba(240,237,234,0.78)",
      icon: "#E8D9B5",
      chevron: "#E8D9B5",
      eyebrowWeight: 700 as const,
      pulse: true,
    },
  }[severity];

  const trailExpect = isSunrise
    ? [
        "Trail temps still cold — layer up before you start moving.",
        "Wildlife most active in the first hour after first light.",
        "Low-angle glare on east-facing climbs; bring a brimmed hat.",
      ]
    : [
        "Light fades faster in canyons and dense forest than in open meadows.",
        "Carry a headlamp — a phone flashlight is not a backup.",
        "Temperature can drop 15–25°F within 90 minutes of last light.",
      ];
  const linkedTipKeys = isSunrise ? ["weather", "wildlife"] : ["weather", "safety"];
  const linked = (tips ?? [])
    .filter((t: any) => {
      const id = String(t?.id ?? "").toLowerCase();
      const title = String(t?.title ?? "").toLowerCase();
      return linkedTipKeys.some((k) => id.includes(k) || title.includes(k));
    })
    .slice(0, 2);

  const panelState: "loading" | "empty" | "ready" =
    tips === null ? "loading" : linked.length > 0 ? "ready" : "empty";

  const [tipsStatus, setTipsStatus] = useState("");
  const prevPanelStateRef = useRef<"loading" | "empty" | "ready" | null>(null);
  useEffect(() => {
    if (!expanded) {
      prevPanelStateRef.current = null;
      setTipsStatus("");
      return;
    }
    const prev = prevPanelStateRef.current;
    if (prev === panelState) return;
    prevPanelStateRef.current = panelState;
    const message =
      panelState === "loading" ? "Loading field tips…"
      : panelState === "ready" ? `Field tips ready. ${linked.length} linked tip${linked.length === 1 ? "" : "s"}.`
      : `No tips for this season (${seasonLabel}).`;
    setTipsStatus(message);
    if (panelState !== "loading") {
      const id = window.setTimeout(() => setTipsStatus(""), 1500);
      return () => window.clearTimeout(id);
    }
  }, [expanded, panelState, linked.length, seasonLabel]);

  const fallbackKey = fallbackTips.map((t: any) => t?.id ?? t?.title ?? "").join("|");
  const [fallbackOpen, setFallbackOpen] = useState(false);
  useEffect(() => { setFallbackOpen(false); }, [expanded, seasonLabel, fallbackKey]);

  const [fallbackResolving, setFallbackResolving] = useState(false);
  useEffect(() => {
    if (panelState !== "empty" || !expanded) {
      setFallbackResolving(false);
      return;
    }
    setFallbackResolving(true);
    const id = window.setTimeout(() => setFallbackResolving(false), 350);
    return () => window.clearTimeout(id);
  }, [panelState, expanded, fallbackKey]);

  return (
    <div className="wa-live-alert" data-severity={severity} style={{ borderBottom: tier.borderBottom }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        aria-expanded={expanded}
        aria-controls="live-alert-panel"
        aria-label={`${headline}. ${subtext}. ${expanded ? "Collapse" : "Expand"} field tips.`}
        id="live-alert-trigger"
        className="wa-live-alert-trigger"
        style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%",
          background: tier.bg, padding: "12px 20px", minWidth: 0, minHeight: 48,
          border: "none", cursor: "pointer", textAlign: "left", color: "inherit",
        }}
      >
        <Icon
          size={16} strokeWidth={1.5} color={tier.icon}
          style={{
            flexShrink: 0,
            animation: tier.pulse ? "wa-live-alert-pulse 1.6s ease-in-out infinite" : "none",
          }}
        />
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 10,
              fontWeight: tier.eyebrowWeight, letterSpacing: "0.18em",
              color: tier.eyebrow, textTransform: "uppercase", margin: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: "0 1 auto", minWidth: 0,
            }}>
              {isSunrise ? (mins <= 5 ? "Sunrise" : "Sunrise in") : (mins <= 5 ? "Sunset" : "Sunset in")}
            </p>
            <span
              className="wa-live-alert-countdown"
              style={{
                fontSize: 16,
                color: tier.eyebrow,
                opacity: 0.95,
                lineHeight: 1,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
              aria-hidden={mins <= 5 ? "true" : undefined}
            >
              {mins <= 5 ? "now" : countdown}
            </span>
          </div>
          <p
            className="wa-live-alert-subtext"
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 400,
              color: tier.subtext, margin: 0,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {subtext}
          </p>
        </div>
        <ChevronRight
          size={16} color={tier.chevron}
          className="wa-live-alert-chevron"
          style={{
            flexShrink: 0,
            ["--chev-rot" as any]: expanded ? "90deg" : "0deg",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            ref={panelRef}
            id="live-alert-panel"
            key="live-alert-panel"
            role="region"
            aria-labelledby="live-alert-trigger"
            tabIndex={-1}
            onKeyDown={handlePanelKeyDown}
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{
              height: "auto", opacity: 1, y: 0,
              transition: {
                height:  { duration: 0.26, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.22, ease: [0.4, 0, 0.2, 1], delay: 0.04 },
                y:       { duration: 0.24, ease: [0.4, 0, 0.2, 1] },
              },
            }}
            exit={{
              height: 0, opacity: 0, y: -4,
              transition: {
                height:  { duration: 0.32, ease: [0.4, 0, 0.2, 1], delay: 0.04 },
                opacity: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
                y:       { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
              },
            }}
            style={{ overflow: "hidden", background: "rgba(201,169,110,0.06)", outline: "none", willChange: "height, opacity, transform" }}
          >
            <div style={{ padding: "14px 20px 16px" }}>
              {/* Live region */}
              <div role="status" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 }}>
                {tipsStatus}
              </div>

              <div style={{ display: "flex", gap: 24, marginBottom: 14 }}>
                <div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", color: "var(--wa-ink-subtle)", textTransform: "uppercase", margin: 0, marginBottom: 2 }}>
                    {isSunrise ? "First light" : "Last light"}
                  </p>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, fontWeight: 400, color: "var(--wa-ink-primary)", margin: 0, letterSpacing: "-0.01em" }}>
                    {eventTimeLabel}
                  </p>
                </div>
                <div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", color: "var(--wa-ink-subtle)", textTransform: "uppercase", margin: 0, marginBottom: 2 }}>
                    Countdown
                  </p>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, fontWeight: 400, color: "var(--wa-ink-primary)", margin: 0, letterSpacing: "-0.01em" }}>
                    {mins <= 0 ? "Now" : countdown}
                  </p>
                </div>
              </div>

              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", color: "var(--wa-ink-subtle)", textTransform: "uppercase", margin: 0, marginBottom: 8 }}>
                What to expect on trails
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {trailExpect.map((line, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#C9A96E", marginTop: 8, flexShrink: 0 }} />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.5, color: "var(--wa-ink-primary)" }}>
                      {line}
                    </span>
                  </li>
                ))}
              </ul>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={panelState === "empty" && fallbackResolving ? "empty-resolving" : panelState}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                >
                  {panelState === "loading" && (
                    <div style={{ marginTop: 14 }} aria-busy="true">
                      <LiveAlertSkeleton size="xs" tone="strong" width={110} style={{ marginBottom: 10 }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[0, 1].map((i) => <LiveAlertSkeleton key={i} size="row" tone="muted" />)}
                      </div>
                    </div>
                  )}

                  {panelState === "empty" && fallbackResolving && (
                    <div style={{ marginTop: 18 }} aria-busy="true" aria-live="polite">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ height: 1, width: 14, background: "#C9A96E", flexShrink: 0 }} />
                        <LiveAlertSkeleton size="xs" tone="strong" width={96} />
                      </div>
                      <div style={{ padding: "16px 16px 18px", background: "rgba(201,169,110,0.05)", borderTop: "1px solid rgba(201,169,110,0.30)", borderBottom: "1px solid rgba(201,169,110,0.18)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                        <LiveAlertSkeleton size="md" tone="strong" width="70%" />
                        <LiveAlertSkeleton size="sm" tone="muted" width="92%" />
                        <div style={{ height: 1, background: "rgba(201,169,110,0.18)", margin: "4px 0" }} />
                        {[0, 1, 2].map((i) => <LiveAlertSkeleton key={i} size="sm" tone="muted" width={`${88 - i * 8}%`} />)}
                      </div>
                    </div>
                  )}

                  {panelState === "empty" && !fallbackResolving && (
                    <div style={{ marginTop: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ height: 1, width: 14, background: "#C9A96E", flexShrink: 0 }} />
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", color: "var(--wa-ink-subtle)", textTransform: "uppercase", margin: 0 }}>
                          Linked field tips
                        </p>
                      </div>
                      <div style={{ padding: "16px 16px 18px", background: "rgba(201,169,110,0.05)", borderTop: "1px solid rgba(201,169,110,0.30)", borderBottom: "1px solid rgba(201,169,110,0.18)", borderRadius: 8 }}>
                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 18, fontWeight: 400, lineHeight: 1.25, letterSpacing: "-0.01em", color: "var(--wa-ink-primary)", margin: 0 }}>
                          No field tips logged for {seasonLabel}.
                        </p>
                        {fallbackTips.length > 0 ? (
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, lineHeight: 1.55, color: "var(--wa-ink-subtle)", margin: "6px 0 0" }}>
                            A few notes from other seasons that still apply year-round:
                          </p>
                        ) : (
                          <div role="note" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(201,169,110,0.18)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "#C9A96E", marginTop: 6, flexShrink: 0, opacity: 0.7 }} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, lineHeight: 1.4, color: "var(--wa-ink-primary)", margin: 0 }}>
                                No field tips logged yet for this park.
                              </p>
                              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, lineHeight: 1.55, color: "var(--wa-ink-subtle)", margin: "4px 0 0" }}>
                                Rangers add seasonal notes as conditions change. Check back soon.
                              </p>
                            </div>
                          </div>
                        )}

                        {fallbackTips.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setFallbackOpen((v) => !v)}
                              aria-expanded={fallbackOpen}
                              aria-controls="live-alert-fallback-list"
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                marginTop: 14, paddingTop: 12, paddingBottom: 8,
                                minHeight: 44, width: "100%",
                                borderTop: "1px solid rgba(201,169,110,0.18)",
                                background: "transparent", border: 0,
                                textAlign: "left", cursor: "pointer",
                                WebkitTapHighlightColor: "transparent",
                              }}
                            >
                              <span style={{ height: 1, width: 10, background: "#C9A96E", flexShrink: 0 }} />
                              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", color: "var(--wa-ink-subtle)", textTransform: "uppercase", flex: 1 }}>
                                From other seasons · {fallbackTips.length}
                              </span>
                              <motion.span
                                animate={{ rotate: fallbackOpen ? 180 : 0 }}
                                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                style={{ display: "inline-flex", color: "var(--wa-ink-subtle)", fontSize: 11, lineHeight: 1 }}
                                aria-hidden="true"
                              >
                                ▾
                              </motion.span>
                            </button>

                            <AnimatePresence initial={false}>
                              {fallbackOpen && (
                                <motion.ul
                                  id="live-alert-fallback-list"
                                  key="fallback-list"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
                                  style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}
                                >
                                  {fallbackTips.map((tip: any, i: number) => (
                                    <li key={tip?.id ?? i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C9A96E", marginTop: 7, flexShrink: 0 }} />
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--wa-ink-primary)", margin: 0, lineHeight: 1.4 }}>
                                            {tip?.title}
                                          </p>
                                          {tip?._seasonLabel && (
                                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A6B2E", background: "rgba(201,169,110,0.16)", border: "1px solid rgba(201,169,110,0.32)", borderRadius: 999, padding: "2px 7px", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                                              {tip._seasonLabel}
                                            </span>
                                          )}
                                        </div>
                                        {tip?.body && (
                                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, lineHeight: 1.5, color: "var(--wa-ink-subtle)", margin: "2px 0 0" }}>
                                            {tip.body}
                                          </p>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </motion.ul>
                              )}
                            </AnimatePresence>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {panelState === "ready" && (
                    <div style={{ marginTop: 14 }}>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", color: "var(--wa-ink-subtle)", textTransform: "uppercase", margin: 0, marginBottom: 8 }}>
                        Linked field tips
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {linked.map((tip: any, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onTipClick?.(tip.id)}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#FFFFFF", border: "1px solid #D4CFC9", borderRadius: 8, minHeight: 44, width: "100%", textAlign: "left", cursor: "pointer", font: "inherit" }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--wa-ink-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {tip.title}
                              </p>
                              {tip.summary && (
                                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "var(--wa-ink-subtle)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {tip.summary}
                                </p>
                              )}
                            </div>
                            <ChevronRight size={14} color="var(--wa-ink-subtle)" style={{ flexShrink: 0 }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LiveAlertBanner = memo(LiveAlertBannerInner);
LiveAlertBanner.displayName = "LiveAlertBanner";

export default DiscoverTips;
