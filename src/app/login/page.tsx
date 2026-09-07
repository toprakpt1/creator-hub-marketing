"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/components/providers";
import { useT } from "@/lib/i18n/provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

const DEMO_EMAIL = "demo@chestblade.com";

const HIGHLIGHTS = [
  { value: "10–50K", labelKey: "login.statCreators" },
  { value: "10", labelKey: "login.statMarkets" },
  { value: "100", labelKey: "login.statRange" },
];

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.7-.06-1.37-.18-2.02H12v3.82h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.74 2.98-4.3 2.98-7.32Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.9a6 6 0 0 1 0-3.8V7.5H3.06a10 10 0 0 0 0 9l3.35-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.5l3.35 2.6C7.2 7.74 9.4 5.98 12 5.98Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { signIn, user, ready } = useAuth();
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const t = useT();

  React.useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  const enter = (address: string) => {
    setLoading(true);
    window.setTimeout(() => {
      signIn(address);
      toast.success(t("login.welcomeBack"), { description: t("login.welcomeBackBody") });
      router.push("/dashboard");
    }, 550);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enter(email.trim() || DEMO_EMAIL);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      {/* Brand panel — hidden on small screens where the form matters more */}
      <div className="relative hidden overflow-hidden border-r border-border bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-tight">Chest Blade Creator Hub</span>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            {t("login.brandTagline")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("login.brandBody")}
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {HIGHLIGHTS.map((h) => (
              <div key={h.labelKey}>
                <div className="text-xl font-semibold tabular text-foreground">{h.value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t(h.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-muted-foreground">
          {t("login.internalTool")}
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher variant="full" />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight">Chest Blade Creator Hub</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("login.subtitle")}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("login.email")}</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={DEMO_EMAIL}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(Boolean(v))}
                  aria-label={t("login.rememberMe")}
                />
                {t("login.rememberMe")}
              </label>
              <button
                type="button"
                onClick={() =>
                  toast(t("login.resetTitle"), { description: t("login.resetBody") })
                }
                className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {t("login.forgotPassword")}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : null}
              {loading ? t("login.signingIn") : t("login.signIn")}
              {!loading && <ArrowRight />}
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-2 text-xs text-muted-foreground">{t("login.or")}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={() => enter(DEMO_EMAIL)}
            >
              <GoogleGlyph />
              {t("login.continueWithGoogle")}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("login.demoHint")}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline-offset-4 hover:underline"
              onClick={() => setEmail(DEMO_EMAIL)}
            >
              {DEMO_EMAIL}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
