import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const FREE_WATCH_LIMIT = 1;

export const useProStatus = () => {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPro(false);
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("is_pro")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsPro(data?.is_pro ?? false);
        setLoading(false);
      });
  }, [user]);

  return { isPro, loading, FREE_WATCH_LIMIT };
};
