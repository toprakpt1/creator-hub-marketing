"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Loader2,
  UserPlus,
  Youtube,
} from "lucide-react";
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
import { SEARCH_REGIONS } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import { isEmail, parseYouTubeInput } from "@/lib/validation";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AddCreatorResponse {
  creator?: Creator;
  created?: boolean;
  warning?: string | null;
  error?: string;
  code?: string;
}

/**
 * Manual creator entry. When a channel link is given the API enriches the
 * record from YouTube (1 quota unit); otherwise the typed fields are enough.
 */
export function CreateCreatorDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated?: (creator: Creator) => void;
}) {
  const t = useT();
  const router = useRouter();

  const [channelInput, setChannelInput] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subscriberCount, setSubscriberCount] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [keywords, setKeywords] = React.useState("");
  const [showDetails, setShowDetails] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duplicate, setDuplicate] = React.useState<Creator | null>(null);

  const reset = React.useCallback(() => {
    setChannelInput("");
    setName("");
    setEmail("");
    setSubscriberCount("");
    setCountry("");
    setDescription("");
    setKeywords("");
    setShowDetails(false);
    setError(null);
    setDuplicate(null);
    setSaving(false);
  }, []);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const channelError =
    channelInput.trim() && !parseYouTubeInput(channelInput)
      ? t("creators.formChannelInvalid")
      : null;
  const emailError = email.trim() && !isEmail(email) ? t("creators.formEmailInvalid") : null;
  const subscribersError =
    subscriberCount.trim() && !/^\d+$/.test(subscriberCount.trim())
      ? t("creators.formSubscribersInvalid")
      : null;
  const formInvalid = Boolean(channelError || emailError || subscribersError);
  const canSubmit =
    !saving &&
    !formInvalid &&
    Boolean(channelInput.trim() || name.trim());

  function messageFor(code: string | undefined, fallback: string | undefined) {
    switch (code) {
      case "invalid_channel":
        return t("creators.formChannelInvalid");
      case "invalid_email":
        return t("creators.formEmailInvalid");
      case "invalid_subscriber_count":
        return t("creators.formSubscribersInvalid");
      case "name_or_channel_required":
      case "name_required":
        return t("creators.formNameRequired");
      default:
        return fallback ?? t("toast.creatorAddFailed");
    }
  }

  async function submit() {
    if (!channelInput.trim() && !name.trim()) {
      setError(t("creators.formNameRequired"));
      return;
    }
    if (formInvalid) return;

    setSaving(true);
    setError(null);
    setDuplicate(null);

    try {
      const res = await fetch("/api/creators/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelInput: channelInput.trim() || undefined,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          subscriberCount: subscriberCount.trim() || undefined,
          country: country || undefined,
          description: description.trim() || undefined,
          keywords,
        }),
      });

      const data = (await res.json()) as AddCreatorResponse;
      if (!res.ok || !data.creator) {
        setError(messageFor(data.code, data.error));
        return;
      }

      if (data.created === false) {
        setDuplicate(data.creator);
        toast.info(t("toast.creatorDuplicate"), {
          description: t("creators.formDuplicateBody"),
        });
        return;
      }

      if (data.warning) {
        toast.warning(t("toast.creatorSavedWithWarning"), {
          description: data.warning,
        });
      } else {
        toast.success(t("toast.creatorAdded", { name: data.creator.name }), {
          description: t("toast.creatorAddedBody"),
        });
      }

      onOpenChange(false);
      onCreated?.(data.creator);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            {t("creators.addManualTitle")}
          </DialogTitle>
          <DialogDescription>{t("creators.addManualSubtitle")}</DialogDescription>
        </DialogHeader>

        {duplicate && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-[13px] font-medium text-foreground">
              {t("creators.formDuplicateTitle", { name: duplicate.name })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("creators.formDuplicateBody")}
            </p>
            <Button size="sm" variant="outline" className="mt-2" asChild>
              <Link href={`/creators/${duplicate.id}`} onClick={() => onOpenChange(false)}>
                <ExternalLink />
                {t("creators.formOpenProfile")}
              </Link>
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="creator-channel">{t("creators.formChannelLabel")}</Label>
            <div className="relative">
              <Youtube className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="creator-channel"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder={t("creators.formChannelPlaceholder")}
                className="pl-9"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {channelError ? (
              <p className="text-[11px] text-destructive">{channelError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">{t("creators.formChannelHint")}</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="creator-name">{t("creators.formNameLabel")}</Label>
              <Input
                id="creator-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("creators.formNamePlaceholder")}
                maxLength={120}
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">{t("creators.formNameHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="creator-email">{t("creators.formEmailLabel")}</Label>
              <Input
                id="creator-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("creators.formEmailPlaceholder")}
                maxLength={254}
                autoComplete="off"
              />
              {emailError ? (
                <p className="text-[11px] text-destructive">{emailError}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{t("creators.formEmailHint")}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-secondary/40"
          >
            <span className="min-w-0 text-xs">
              <span className="font-medium text-foreground">{t("creators.formMore")}</span>
              <span className="ml-1.5 text-muted-foreground">{t("creators.formMoreHint")}</span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                showDetails && "rotate-180"
              )}
            />
          </button>

          {showDetails && (
            <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="creator-subs">{t("creators.formSubscribersLabel")}</Label>
                  <Input
                    id="creator-subs"
                    value={subscriberCount}
                    onChange={(e) => setSubscriberCount(e.target.value)}
                    placeholder={t("creators.formSubscribersPlaceholder")}
                    inputMode="numeric"
                    maxLength={12}
                  />
                  {subscribersError && (
                    <p className="text-[11px] text-destructive">{subscribersError}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="creator-country">{t("creators.formCountryLabel")}</Label>
                  <Select
                    value={country || "none"}
                    onValueChange={(v) => setCountry(v === "none" ? "" : v)}
                  >
                    <SelectTrigger id="creator-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("creators.formCountryAny")}</SelectItem>
                      {SEARCH_REGIONS.filter((r) => r.code).map((r) => (
                        <SelectItem key={r.code} value={r.code}>
                          <span aria-hidden className="mr-1.5">
                            {r.flag}
                          </span>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="creator-keywords">{t("creators.formKeywordsLabel")}</Label>
                <Input
                  id="creator-keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder={t("creators.formKeywordsPlaceholder")}
                  maxLength={200}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("creators.formKeywordsHint")}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="creator-description">{t("creators.formDescriptionLabel")}</Label>
                <Textarea
                  id="creator-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("creators.formDescriptionPlaceholder")}
                  maxLength={2000}
                  className="min-h-[64px]"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-[13px] text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!canSubmit} onClick={() => void submit()}>
            {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {saving ? t("creators.formSubmitting") : t("creators.formSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
