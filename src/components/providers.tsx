"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/provider";

const AUTH_KEY = "cb_hub_session";

export interface DemoUser {
  name: string;
  email: string;
  role: string;
}

interface AuthValue {
  user: DemoUser | null;
  /** false until localStorage has been read — prevents redirect flicker. */
  ready: boolean;
  signIn: (email: string) => void;
  signOut: () => void;
}

const AuthContext = React.createContext<AuthValue>({
  user: null,
  ready: false,
  signIn: () => {},
  signOut: () => {},
});

export function useAuth() {
  return React.useContext(AuthContext);
}

function nameFromEmail(email: string) {
  const handle = email.split("@")[0] || "demo";
  return handle
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

/**
 * Demo-only session. Deliberately client-side and unauthenticated — swap for
 * a real provider (NextAuth / Clerk / custom) without touching consumers.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<DemoUser | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AUTH_KEY);
      if (raw) setUser(JSON.parse(raw) as DemoUser);
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  const signIn = React.useCallback((email: string) => {
    const next: DemoUser = {
      name: nameFromEmail(email) || "Demo User",
      email,
      role: "Marketing Lead",
    };
    setUser(next);
    try {
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const signOut = React.useCallback(() => {
    setUser(null);
    try {
      window.localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo(
    () => ({ user, ready, signIn, signOut }),
    [user, ready, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <TooltipProvider delayDuration={250}>
          {children}
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
