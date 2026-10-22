"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  MoreHorizontal,
  ListPlus,
  Megaphone,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { AddToCampaignDialog, AddToListDialog } from "@/components/creators/add-to-group";
import { SendEmailDialog } from "@/components/outreach/send-email-dialog";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { copyWithToast } from "@/lib/clipboard";
import { useT } from "@/lib/i18n/provider";
import type { Creator, CreatorStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function channelUrl(creator: Pick<Creator, "youtubeChannelId" | "handle">) {
  if (creator.handle) return `https://youtube.com/${creator.handle}`;
  return creator.youtubeChannelId
    ? `https://youtube.com/channel/${creator.youtubeChannelId}`
    : null;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("common.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shared mutation helpers — every write goes through the API, never the DB. */
export async function patchCreator(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/creators/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Update failed");
  return data;
}

export async function analyzeCreatorRequest(id: string, videoCount = 10) {
  const res = await fetch(`/api/creators/${id}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoCount }),
  });
  const data = (await res.json()) as { error?: string; videosAnalyzed?: number };
  if (!res.ok) throw new Error(data.error ?? "Analysis failed");
  return data;
}

export function CreatorRowActions({
  creator,
  onChanged,
}: {
  creator: Creator;
  onChanged?: () => void;
}) {
  const t = useT();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [campaignOpen, setCampaignOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const url = channelUrl(creator);

  const setStatus = async (status: CreatorStatus, messageKey: string) => {
    try {
      await patchCreator(creator.id, { status });
      toast.success(t(messageKey, { name: creator.name }));
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const analyze = async () => {
    setBusy(true);
    const id = toast.loading(t("creators.analyzing", { name: creator.name }));
    try {
      const result = await analyzeCreatorRequest(creator.id);
      toast.success(t("creators.analyzeDone", { count: result.videosAnalyzed ?? 0 }), {
        id,
        description: t("creators.analyzeCost"),
      });
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message, { id });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      const res = await fetch(`/api/creators/${creator.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("creators.removed", { name: creator.name }));
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
      {creator.email && (
        <SimpleTooltip label={t("outreach.sendTo", { email: creator.email })}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-primary"
            aria-label={t("outreach.sendActionFor", { name: creator.name })}
            onClick={() => setSendOpen(true)}
          >
            <Send />
          </Button>
        </SimpleTooltip>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("creators.rowActionsFor", { name: creator.name })}
          >
            {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/creators/${creator.id}`}>
              <UserRound />
              {t("creators.openProfileAction")}
            </Link>
          </DropdownMenuItem>
          {url && (
            <>
              <DropdownMenuItem
                onSelect={() => window.open(url, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink />
                {t("creators.openChannel")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void copyWithToast(url, t("creators.copyChannelUrl"))}
              >
                <Copy />
                {t("creators.copyChannelUrl")}
              </DropdownMenuItem>
            </>
          )}
          {creator.email && (
            <DropdownMenuItem
              onSelect={() => void copyWithToast(creator.email!, t("creatorDetail.fieldEmail"))}
            >
              <Mail />
              {t("creators.copyEmail")}
            </DropdownMenuItem>
          )}

          {creator.email && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSendOpen(true)}>
                <Send />
                {t("outreach.sendEmail")}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setListOpen(true)}>
            <ListPlus />
            {t("creators.addToList")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCampaignOpen(true)}>
            <Megaphone />
            {t("creators.addToCampaign")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!creator.uploadsPlaylistId}
            title={
              creator.uploadsPlaylistId ? undefined : t("creators.analyzeUnavailableBody")
            }
            onSelect={() => void analyze()}
          >
            <BarChart3 />
            {t("creators.analyzeVideos")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => void setStatus("qualified", "toast.markedQualified")}
          >
            <ThumbsUp />
            {t("creators.markQualified")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void setStatus("rejected", "toast.markedRejected")}
          >
            <ThumbsDown />
            {t("creators.markRejected")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 />
            {t("creators.removeFromDb")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SendEmailDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        creator={creator}
        onSent={onChanged}
      />
      <AddToListDialog
        open={listOpen}
        onOpenChange={setListOpen}
        creatorIds={[creator.id]}
        onDone={onChanged}
      />
      <AddToCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        creatorIds={[creator.id]}
        onDone={onChanged}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("creators.removeTitle", { name: creator.name })}
        description={t("creators.removeBody")}
        confirmLabel={t("creators.removeFromDb")}
        destructive
        onConfirm={() => void remove()}
      />
    </div>
  );
}
