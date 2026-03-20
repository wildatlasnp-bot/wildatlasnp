import { useState, useRef, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { RefreshCw } from "lucide-react";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
}

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

const PullToRefresh = ({ children, onRefresh, className = "" }: PullToRefreshProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const hasVibrated = useRef(false);
  
  const pullDistance = useMotionValue(0);
  const indicatorY = useTransform(pullDistance, [0, MAX_PULL], [-40, 40]);
  const indicatorOpacity = useTransform(pullDistance, [0, PULL_THRESHOLD * 0.5, PULL_THRESHOLD], [0, 0.5, 1]);
  const indicatorRotation = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 180]);
  const indicatorScale = useTransform(pullDistance, [PULL_THRESHOLD, MAX_PULL], [1, 1.15]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    touchStartY.current = e.touches[0].clientY;
    isPulling.current = true;
    hasVibrated.current = false;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isPulling.current = false;
      pullDistance.set(0);
      return;
    }

    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      // Rubber-band effect: diminishing returns as you pull further
      const pull = Math.min(MAX_PULL, deltaY * 0.5);
      const previousPull = pullDistance.get();
      pullDistance.set(pull);
      
      // Haptic feedback when crossing threshold
      if (pull >= PULL_THRESHOLD && previousPull < PULL_THRESHOLD && !hasVibrated.current) {
        hasVibrated.current = true;
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      }
      
      // Prevent scroll when pulling
      if (deltaY > 10) {
        e.preventDefault();
      }
    }
  }, [refreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    const currentPull = pullDistance.get();
    
    if (currentPull >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      // Snap to loading position
      animate(pullDistance, 50, { duration: 0.2 });
      
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        animate(pullDistance, 0, { duration: 0.25, ease: "easeOut" });
      }
    } else {
      // Spring back
      animate(pullDistance, 0, { duration: 0.3, ease: "easeOut" });
    }
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div className={`relative h-full min-h-0 ${className}`}>
      {/* Pull indicator */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center"
        style={{ y: indicatorY, opacity: indicatorOpacity, scale: indicatorScale }}
      >
        <motion.div
          className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg ${
            refreshing 
              ? "bg-primary text-primary-foreground" 
              : "bg-card text-muted-foreground border border-border"
          }`}
          style={{ rotate: refreshing ? undefined : indicatorRotation }}
          animate={refreshing ? { rotate: 360 } : undefined}
          transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : undefined}
        >
          <RefreshCw size={16} />
        </motion.div>
      </motion.div>

      {/* Content wrapper */}
      <motion.div
        ref={containerRef}
        className="h-full min-h-0 overflow-y-auto"
        style={{ y: useTransform(pullDistance, (v) => Math.min(v * 0.4, 48)) }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-tab-scroll
      >
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;
