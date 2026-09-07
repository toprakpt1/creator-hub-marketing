"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Megaphone, MoreHorizontal, Pause, Play, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/creators/creator-actions";
import { SegmentedFilter } from "@/components/creators/filter-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { Campaign, CampaignStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | CampaignStatus;

const STATUS_TONE: Record<CampaignStatus, string> = {
  active: "bg-success",
  paused: "bg-warning",
  draft: "bg-muted-foreground",
  completed: "bg-muted-foreground",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/40 px-1 py-1.5">
      <div className="text-[13px] font-medium tabular">{value}</div>
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const t = useT();
  return (
    <Badge
      variant={status === "active" ? "success" : status === "paused" ? "warning" : "muted"}
      className="gap-1.5"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_TONE[status])} />
      {t(`status.campaign.${status}`)}
    </Badge>
  );
}

export function CampaignsGrid({ campaigns }: { campaigns: Campaign[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Campaign | null>(null);

  const filtered = campaigns.filter((c) => status === "all" || c.status === status);

  async function patch(id: string, body: Record<string, unknown>, message: string) {
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(message);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(id: string, name: string) {
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("campaigns.deletedToast", { name }));
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedFilter
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: t("campaigns.filterAll", { count: campaigns.length }) },
            { value: "active", label: t("status.campaign.active") },
            { value: "draft", label: t("status.campaign.draft") },
            { value: "paused", label: t("status.campaign.paused") },
            { value: "completed", label: t("status.campaign.completed") },
          ]}
        />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("campaigns.newCampaign")}
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t("campaigns.emptyDbTitle")}
          description={t("campaigns.emptyDbBody")}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("campaigns.newCampaign")}
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("campaigns.emptyTitle")} description={t("campaigns.emptyBody")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((campaign) => {
            const { funnel } = campaign;
            const progress = funnel.added
              ? Math.round((funnel.qualified / funnel.added) * 100)
              : 0;
            return (
              <Card
                key={campaign.id}
                className="flex flex-col transition-colors hover:border-primary/30"
              >
                <CardContent className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="block truncate text-[14px] font-semibold hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.goal && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {campaign.goal}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("campaigns.campaignActions", { name: campaign.name })}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href={`/campaigns/${campaign.id}`}>
                            <ArrowRight />
                            {t("campaigns.openCampaign")}
                          </Link>
                        </DropdownMenuItem>
                        {campaign.status === "active" ? (
                          <DropdownMenuItem
                            onSelect={() =>
                              void patch(
                                campaign.id,
                                { status: "paused" },
                                t("campaigns.pausedToast", { name: campaign.name })
                              )
                            }
                          >
                            <Pause />
                            {t("campaigns.pauseCampaign")}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() =>
                              void patch(
                                campaign.id,
                                { status: "active" },
                                t("campaigns.activatedToast", { name: campaign.name })
                              )
                            }
                          >
                            <Play />
                            {t("campaigns.activateCampaign")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleteTarget(campaign)}
                        >
                          <Trash2 />
                          {t("campaigns.deleteCampaign")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <CampaignStatusBadge status={campaign.status} />
                    {campaign.startDate && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(campaign.startDate, locale)}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-1.5 text-center">
                    <Metric label={t("campaigns.cardCreators")} value={String(funnel.added)} />
                    <Metric label={t("campaigns.cardQualified")} value={String(funnel.qualified)} />
                    <Metric label={t("campaigns.cardContacted")} value={String(funnel.contacted)} />
                    <Metric label={t("campaigns.cardReplies")} value={String(funnel.replied)} />
                    <Metric label={t("campaigns.cardPublished")} value={String(funnel.published)} />
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t("campaigns.qualifiedShare")}</span>
                      <span className="tabular">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>

                  <div className="mt-auto pt-4 text-[11px] text-muted-foreground">
                    {t("campaigns.outreachPending")}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={t("campaigns.deleteTitle", { name: deleteTarget?.name ?? "" })}
        description={t("campaigns.deleteBody")}
        confirmLabel={t("campaigns.deleteCampaign")}
        destructive
        onConfirm={() => deleteTarget && void remove(deleteTarget.id, deleteTarget.name)}
      />
    </div>
  );
}

export function CreateCampaignDialog({
  open,
  onOpenChange,
  creatorIds,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorIds?: string[];
  onCreated?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), goal, creatorIds }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create the campaign.");
      toast.success(t("campaigns.createdToast", { name: name.trim() }), {
        description: creatorIds?.length
          ? t("campaigns.createdWithCreators", { count: creatorIds.length })
          : t("campaigns.createdToastBody"),
      });
      setName("");
      setGoal("");
      onOpenChange(false);
      onCreated?.();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("campaigns.createTitle")}</DialogTitle>
          <DialogDescription>{t("campaigns.createDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">{t("campaigns.nameLabel")}</Label>
            <Input
              id="cc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("campaigns.namePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-goal">{t("campaigns.goalLabel")}</Label>
            <Textarea
              id="cc-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("campaigns.goalPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!name.trim() || saving} onClick={() => void submit()}>
            {t("campaigns.createSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
