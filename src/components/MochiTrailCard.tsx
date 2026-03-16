import { forwardRef } from "react";
import { MapPin, Clock, ExternalLink } from "lucide-react";

export interface TrailData {
  trail_name: string;
  distance: string;
  difficulty: string;
  estimated_time: string;
  short_description: string;
}

/** Parse ```trails JSON blocks from a Mochi message, returning text segments and trail card arrays */
export function parseTrailBlocks(content: string): Array<{ type: "text"; value: string } | { type: "trails"; value: TrailData[] }> {
  const parts: Array<{ type: "text"; value: string } | { type: "trails"; value: TrailData[] }> = [];
  const regex = /```trails\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // Text before the block
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    // Parse JSON
    try {
      const parsed = JSON.parse(match[1]);
      const trails: TrailData[] = (Array.isArray(parsed) ? parsed : [parsed]).filter(
        (t: any) => t.trail_name
      );
      if (trails.length > 0) {
        parts.push({ type: "trails", value: trails });
      }
    } catch {
      // If JSON is malformed, render as text
      parts.push({ type: "text", value: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: content }];
}

const difficultyColor: Record<string, string> = {
  easy: "text-status-quiet",
  moderate: "text-amber-600 dark:text-amber-400",
  hard: "text-status-busy",
  strenuous: "text-status-busy",
};

const MochiTrailCard = forwardRef<HTMLDivElement, { trail: TrailData }>(({ trail }, ref) => {
  const diffClass = difficultyColor[trail.difficulty.toLowerCase()] ?? "text-muted-foreground";

  return (
    <div
      ref={ref}
      className="bg-card border border-border/50 rounded-2xl p-4 space-y-2"
      style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
    >
      <p className="text-[16px] font-semibold text-foreground leading-snug">{trail.trail_name}</p>

      <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin size={10} className="shrink-0" />
          {trail.distance}
        </span>
        <span className="text-border">•</span>
        <span className={diffClass}>{trail.difficulty}</span>
        <span className="text-border">•</span>
        <span className="flex items-center gap-1">
          <Clock size={10} className="shrink-0" />
          {trail.estimated_time}
        </span>
      </div>

      <p className="text-[12px] text-muted-foreground leading-relaxed">{trail.short_description}</p>

      <a
        href={`https://www.google.com/search?q=${encodeURIComponent(trail.trail_name + " trail hiking")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-secondary hover:text-secondary/80 active:scale-[0.97] transition-all pt-1"
      >
        View trail
        <ExternalLink size={10} />
      </a>
    </div>
  );
}
