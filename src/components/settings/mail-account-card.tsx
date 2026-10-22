"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  PlugZap,
  Unplug,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { MailAccountSummary } from "@/lib/types";

/**
 * Connect / verify / disconnect the single Gmail account.
 *
 * The browser only ever sees the address and timestamps — tokens stay in the
 * SQLite row, encrypted.
 */
export function MailAccountCard({
  account,
  oauthConfigured,
}: {
  account: MailAccountSummary | null;
  oauthConfigured: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [testing, setTesting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [redirectUri, setRedirectUri] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/mail/gmail")
      .then((r) => r.json())
      .then((d: { redirectUri?: string }) => setRedirectUri(d.redirectUri ?? null))
      .catch(() => setRedirectUri(null));
  }, []);

  const connectedOn = account
    ? new Date(account.connectedAt).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  async function test() {
    setTesting(true);
    try {
      const res = await fetch("/api/mail/gmail", { method: "POST" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? t("settings.mailTestFailed"));
      toast.success(t("settings.mailTestOk"));
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/mail/gmail", { method: "DELETE" });
      if (!res.ok) throw new Error(t("settings.mailDisconnectFailed"));
      toast.success(t("settings.mailDisconnected"));
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function copyRedirect() {
    if (!redirectUri) return;
    const ok = await copyToClipboard(redirectUri);
    if (ok) toast.success(t("settings.mailCopied"));
    else toast.error(t("settings.mailCopyFailed"));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{t("settings.mailTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("settings.mailDesc")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {account ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/40 bg-success/[0.06] p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-success/15">
                <Mail className="h-4 w-4 text-success" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{account.email}</div>
                <div className="text-xs text-muted-foreground">
                  {t("settings.mailConnectedAt", { date: connectedOn ?? "—" })}
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("settings.mailConnectedBadge")}
              </span>
            </div>

            {account.needsReconnect && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.07] px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {t("settings.mailNeedsReconnect")}
                  {account.lastError ? ` ${account.lastError}` : ""}
                </span>
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={testing} onClick={() => void test()}>
                {testing ? <Loader2 className="animate-spin" /> : <PlugZap />}
                {testing ? t("settings.mailTesting") : t("settings.mailTest")}
              </Button>

              <Button variant="outline" size="sm" asChild>
                <a href="/api/mail/gmail/connect">
                  <Mail />
                  {t("settings.mailReconnect")}
                </a>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={disconnecting}>
                    {disconnecting ? <Loader2 className="animate-spin" /> : <Unplug />}
                    {t("settings.mailDisconnect")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("settings.mailDisconnectTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("settings.mailDisconnectBody", { email: account.email })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void disconnect()}>
                      {t("settings.mailDisconnect")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Separator />
            <p className="text-xs text-muted-foreground">{t("settings.mailScope")}</p>
          </>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground">{t("settings.mailNotConnected")}</p>

            {!oauthConfigured && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t("settings.mailOauthMissing")}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {oauthConfigured ? (
                <Button size="sm" asChild>
                  <a href="/api/mail/gmail/connect">
                    <Mail />
                    {t("settings.mailConnect")}
                  </a>
                </Button>
              ) : (
                <Button size="sm" disabled>
                  <Mail />
                  {t("settings.mailConnect")}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{t("settings.mailConnectHint")}</span>
            </div>

            <Separator />
            <p className="text-xs text-muted-foreground">{t("settings.mailSmtpFallback")}</p>
          </>
        )}

        {redirectUri && (
          <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("settings.mailRedirectLabel")}
            </div>
            <div className="mt-1 flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed">
                {redirectUri}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2"
                onClick={() => void copyRedirect()}
              >
                <Copy className="h-3.5 w-3.5" />
                {t("settings.mailCopy")}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("settings.mailRedirectHint")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
