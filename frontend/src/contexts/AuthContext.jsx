import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) console.error("loadProfile error:", error);
      setProfile(data || null);
    } catch (e) {
      console.error("loadProfile exception:", e);
      setProfile(null);
    }
  }, []);

  // Effect 1: resolve initial session as fast as possible. Do NOT wait for profile.
  useEffect(() => {
    let mounted = true;

    // Safety timeout — never gate the app for more than 5 seconds.
    const safety = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
      })
      .catch((e) => console.error("getSession error:", e))
      .finally(() => {
        if (mounted) setLoading(false);
        clearTimeout(safety);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safety);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Effect 2: load profile whenever the user id changes.
  useEffect(() => {
    loadProfile(session?.user?.id);
  }, [session?.user?.id, loadProfile]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  };

  const refreshProfile = () => loadProfile(session?.user?.id);

  const value = {
    session,
    user: session?.user || null,
    profile,
    role: profile?.role,
    isAdmin: profile?.role === "admin",
    loading,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
