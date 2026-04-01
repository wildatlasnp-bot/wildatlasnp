import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { usePermitDefs } from "@/hooks/usePermitDefs";
import { usePermitAvailability } from "@/hooks/usePermitAvailability";
import { useWatches } from "@/hooks/useWatches";
import { ALL_PARK_IDS } from "@/lib/parks";

// Re-export types for backward compatibility
export type { PermitAvailability } from "@/hooks/usePermitAvailability";
export type { PermitDefWithPark, ParkPermitGroup } from "@/hooks/usePermitDefs";

/**
 * Composition hook — thin orchestration layer over focused hooks.
 *
 * Replaces the former 466-line god hook (MED-2) by composing:
 * - usePermitDefs: park permit definitions + caching
 * - usePermitAvailability: availability data + Realtime subscription (MED-1)
 * - useWatches: watch CRUD, Realtime "found" events, phone/SMS state
 */
export function useSniperData() {
  const { user } = useAuth();
  const { isPro, FREE_WATCH_LIMIT } = useProStatus();

  const { permitDefs, permitDefsRef, defsLoaded, parkPermitGroups } = usePermitDefs();
  const avail = usePermitAvailability(ALL_PARK_IDS);
  const w = useWatches(permitDefsRef);

  const initialLoading = !defsLoaded || !w.watchesLoaded;

  // Stable getTimeAgo — always reads Date.now() at call time
  const getTimeAgo = useCallback((dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }, []);

  const getAvailability = useCallback(
    (permitName: string, parkCode?: string) =>
      avail.availability.filter((a) => a.permit_type === permitName && (!parkCode || a.park_code === parkCode)),
    [avail.availability]
  );

  const totalAvailDates = avail.availability.length;

  return {
    // Auth & Pro
    user,
    isPro,
    FREE_WATCH_LIMIT,
    initialLoading,

    // Permit definitions
    permitDefs,
    parkPermitGroups,

    // Availability
    availability: avail.availability,
    lastChecked: avail.lastChecked,
    scanPulse: avail.scanPulse,
    refreshing: avail.refreshing,
    fetchAvailability: avail.fetchAvailability,
    totalAvailDates,

    // Watches
    watches: w.watches,
    loadingId: w.loadingId,
    hasPhone: w.hasPhone,
    showPhoneInput: w.showPhoneInput,
    successOpen: w.successOpen,
    foundPermit: w.foundPermit,
    proModalOpen: w.proModalOpen,
    activeCount: w.activeCount,
    alertCount: w.alertCount,
    foundCount: w.foundCount,

    // Actions
    getTimeAgo,
    getWatchState: w.getWatchState,
    getAvailability,
    toggleWatch: w.toggleWatch,
    deleteWatch: w.deleteWatch,
    toggleNotify: w.toggleNotify,
    setShowPhoneInput: w.setShowPhoneInput,
    handlePhoneSaved: w.handlePhoneSaved,
    setSuccessOpen: w.setSuccessOpen,
    setProModalOpen: w.setProModalOpen,
  };
}
