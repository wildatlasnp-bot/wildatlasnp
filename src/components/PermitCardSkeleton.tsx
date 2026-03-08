const PermitCardSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-4" aria-busy="true" role="status" aria-label="Loading permit cards">
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className="permit-skeleton-shimmer rounded-xl p-5 border border-border/60 bg-card"
        style={{ animationDelay: `${i * 150}ms` }}
      >
        {/* Header row — matches WatchCard layout */}
        <div className="flex items-start gap-3.5">
          {/* Icon placeholder */}
          <div className="w-9 h-9 rounded-lg bg-muted shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title placeholder ~60% */}
            <div className="h-4 w-[60%] rounded bg-muted" />
            {/* Subtitle placeholder ~40% */}
            <div className="h-3 w-[40%] rounded bg-muted" />
          </div>
          {/* Status badge placeholder */}
          <div className="h-5 w-16 rounded-full bg-muted shrink-0 mt-1" />
        </div>

        {/* Action row placeholder */}
        <div className="flex items-center gap-3 mt-4">
          <div className="h-9 w-full rounded-lg bg-muted" />
        </div>
      </div>
    ))}
  </div>
);

export default PermitCardSkeleton;
