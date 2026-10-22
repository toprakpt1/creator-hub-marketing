"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Mail, Send, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { relativeTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { OutreachMessage } from "@/lib/types";

interface StatusPayload {
  mailer: {
    configured: boolean;
    provider: "gmail" | "smtp" | null;
    host: string | null;
    fromEmail: string | null;
    needsReconnect?: boolean;
    lastError?: string | null;
  };
  usage: { used: number; limit: number; remaining: number };
  stats: { total: number; sent: number; failed: number; creators: number };
  messages: OutreachMessage[];
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular">{value}</div>
    </Card>
  );
}

/**
 * The outreach log.
 *
 * Everything here is read back from what was actually sent — there is no
 * scheduling, queueing or automation behind it. A message appears only after
 * the panel handed it to the mail server.
 */
export function OutreachWorkspace() {
  const t = useT();
  const locale = useLocale();
  const [data, setData] = React.useState<StatusPayload | null>(null);
  const [testing, setTesting] = React.useState(false);

  const load = React.useCallback(() => {
    fetch("/api/outreach/status")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  React.useEffect(load, [load]);

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/outreach/status", { method: "POST" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Connection failed.");
      toast.success(t("outreach.testOk"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-5">
      {/* Mail account */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>{t("outreach.setupTitle")}</CardTitle>
          <div className="flex items-center gap-2">
            {data.mailer.configured && (
              <Button variant="outline" size="sm" disabled={testing} onClick={() => void testConnection()}>
                {testing ? <Loader2 className="animate-spin" /> : <Mail />}
                {t("outreach.testConnection")}
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings?section=mail">
                <Mail />
                {t("outreach.manageMail")}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.mailer.configured ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              {data.mailer.provider === "gmail"
                ? t("outreach.setupGmail", { email: data.mailer.fromEmail ?? "—" })
                : t("outreach.setupConfigured", {
                    from: data.mailer.fromEmail ?? "—",
                    host: data.mailer.host ?? "—",
                  })}
            </p>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p>
                  {data.mailer.needsReconnect
                    ? t("outreach.setupNeedsReconnect")
                    : t("outreach.setupMissing")}
                </p>
                {data.mailer.lastError && (
                  <p className="mt-1 opacity-80">{data.mailer.lastError}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("outreach.statSent")} value={data.stats.sent} />
        <Stat label={t("outreach.statFailed")} value={data.stats.failed} />
        <Stat label={t("outreach.statCreators")} value={data.stats.creators} />
        <Stat
          label={t("outreach.statToday")}
          value={`${data.usage.used} / ${data.usage.limit}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("outreach.logTitle")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("outreach.logDesc")}</p>
        </CardHeader>
        <CardContent className={data.messages.length > 0 ? "px-0 pb-0" : undefined}>
          {data.messages.length === 0 ? (
            <EmptyState
              icon={Send}
              title={t("outreach.logEmpty")}
              description={t("outreach.sendNote")}
              action={
                <Button size="sm" asChild>
                  <Link href="/creators">
                    <Mail />
                    {t("dashboard.viewAllCreators")}
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">{t("outreach.colStatus")}</TableHead>
                  <TableHead>{t("creators.colCreator")}</TableHead>
                  <TableHead>{t("outreach.colTo")}</TableHead>
                  <TableHead>{t("outreach.colSubject")}</TableHead>
                  <TableHead className="pr-4 text-right">{t("outreach.colWhen")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.messages.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-4">
                      {m.status === "sent" ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("status.creator.contacted")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1" title={m.error ?? undefined}>
                          <XCircle className="h-3 w-3" />
                          {t("outreach.statFailed")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/creators/${m.creatorId}`}
                        className="text-[13px] font-medium hover:underline"
                      >
                        {m.creatorName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{m.toEmail}</TableCell>
                    <TableCell className="max-w-[320px] truncate text-[13px]">{m.subject}</TableCell>
                    <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                      {relativeTime(m.sentAt ?? m.createdAt, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
