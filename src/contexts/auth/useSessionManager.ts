import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

const isConfirmed = (u: User | null) =>
  !!u?.email_confirmed_at || !!u?.confirmed_at;

interface SessionCallbacks {
  onConfirmedUser: (user: User, session: Session) => void;
  onNoUser: () => void;
}

/**
 * Manages Supabase session lifecycle: initial restoration + auth state changes.
 * Extracted from AuthProvider to isolate session plumbing.
 */
export function useSessionManager(callbacks: SessionCallbacks) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(
    (sess: Session | null, source: string) => {
      const confirmedUser = sess?.user && isConfirmed(sess.user) ? sess.user : null;
      console.log(
        `[auth] applySession(${source}): session=${!!sess}, confirmed=${!!confirmedUser}, userId=${confirmedUser?.id?.slice(0, 8) ?? "none"}`
      );
      setSession(confirmedUser ? sess : null);
      setUser(confirmedUser);

      if (confirmedUser && sess) {
        callbacks.onConfirmedUser(confirmedUser, sess);
      } else {
        if (sess?.user) {
          console.log(
            `[auth] applySession(${source}): clearing user state, sess.user exists=true, confirmed_at=${sess.user.confirmed_at}, email_confirmed_at=${sess.user.email_confirmed_at}`
          );
        }
        callbacks.onNoUser();
      }
    },
    [callbacks]
  );

  useEffect(() => {
    let initialSessionRestored = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initialSessionRestored) return;
      console.log(`[auth] onAuthStateChange event=${_event}`);
      applySession(session, `onAuthStateChange:${_event}`);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session, "getSession");
      setLoading(false);
      initialSessionRestored = true;
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  return { user, session, loading };
}
