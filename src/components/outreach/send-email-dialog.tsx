"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { renderTemplate, unresolvedVariables } from "@/lib/outreach/render";
import { useT } from "@/lib/i18n/provider";
import type { Creator, EmailTemplate } from "@/lib/types";

interface MailerStatus {
  configured: boolean;
  fromName?: string;
  fromEmail?: string;
}

/**
 * Compose and send one outreach email.
 *
 * The person sees the finished message — variables already filled — and can
 * edit it before sending. What is on screen is exactly what goes out: the
 * dialog posts the rendered text, so there is no second substitution pass
 * that could differ from the preview.
 */
export function SendEmailDialog({
  open,
  onOpenChange,
  creator,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creator: Creator;
  onSent?: () => void;
}) {
  const t = useT();
  const router = useRouter();

  const [templates, setTemplates] = React.useState<EmailTemplate[] | null>(null);
  const [templateId, setTemplateId] = React.useState<string>("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [mailer, setMailer] = React.useState<MailerStatus | null>(null);
  const [usage, setUsage] = React.useState<{ used: number; limit: number } | null>(null);
  const [contacted, setContacted] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  // Everything the dialog needs is fetched on open, so a template written a
  // moment ago is already selectable.
  React.useEffect(() => {
    if (!open) return;
    setTouched(false);

    fetch("/api/templates")
      .then((r) => r.json())
      .then((d: { templates?: EmailTemplate[] }) => {
        const list = d.templates ?? [];
        setTemplates(list);
        if (list.length > 0) setTemplateId((prev) => prev || list[0].id);
      })
      .catch(() => setTemplates([]));

    fetch("/api/outreach/status")
      .then((r) => r.json())
      .then((d) => {
        setMailer(d.mailer ?? { configured: false });
        setUsage(d.usage ?? null);
        setContacted(
          (d.messages ?? []).some(
            (m: { creatorId: string; status: string }) =>
              m.creatorId === creator.id && m.status === "sent"
          )
        );
      })
      .catch(() => setMailer({ configured: false }));
  }, [open, creator.id]);

  const selected = templates?.find((x) => x.id === templateId) ?? null;

  // Load the chosen template, but never overwrite edits already made.
  React.useEffect(() => {
    if (!selected || touched) return;
    setSubject(renderTemplate(selected.subject, creator));
    setBody(renderTemplate(selected.body, creator));
  }, [selected, creator, touched]);

  const leftover = React.useMemo(
    () => [
      ...new Set([
        ...unresolvedVariables(subject, creator),
        ...unresolvedVariables(body, creator),
      ]),
    ],
    [subject, body, creator]
  );

  const canSend =
    !!creator.email &&
    mailer?.configured === true &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    leftover.length === 0 &&
    !sending;

  async function send() {
    setSending(true);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: creator.id,
          templateId: templateId || undefined,
          subject,
          body,
          allowResend: contacted,
        }),
      });
      const data = (await res.json()) as { error?: string; usage?: { used: number } };
      if (!res.ok) throw new Error(data.error ?? "Sending failed.");

      toast.success(t("outreach.sentToast", { name: creator.name }), {
        description: t("outreach.sentToastBody", { email: creator.email ?? "" }),
      });
      onOpenChange(false);
      onSent?.();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("outreach.composeTitle", { name: creator.name })}</DialogTitle>
          <DialogDescription>
            {creator.email
              ? t("outreach.composeTo", {
                  email: creator.email,
                  from: mailer?.fromEmail ?? "—",
                })
              : t("outreach.noEmail")}
          </DialogDescription>
        </DialogHeader>

        {mailer && !mailer.configured && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("outreach.notConfigured")}
          </p>
        )}

        {contacted && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("outreach.alreadyContacted", { name: creator.name })}
          </p>
        )}

        <div className="space-y-3">
          {templates && templates.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("outreach.templateLabel")}</Label>
              <Select
                value={templateId}
                onValueChange={(v) => {
                  setTemplateId(v);
                  setTouched(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {templates && templates.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              {t("outreach.noTemplates")}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="outreach-subject">{t("templates.subject")}</Label>
            <Input
              id="outreach-subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setTouched(true);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="outreach-body">{t("templates.body")}</Label>
            <Textarea
              id="outreach-body"
              value={body}
              rows={12}
              className="font-normal leading-relaxed"
              onChange={(e) => {
                setBody(e.target.value);
                setTouched(true);
              }}
            />
          </div>

          {leftover.length > 0 && (
            <p className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("outreach.unresolved", { vars: leftover.join(", ") })}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            {t("outreach.sendNote")}
            {usage && ` · ${t("outreach.usageLine", { used: usage.used, limit: usage.limit })}`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!canSend} onClick={() => void send()}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            {sending ? t("outreach.sending") : t("outreach.sendNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
