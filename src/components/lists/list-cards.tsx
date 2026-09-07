"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
import { toast } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/creators/creator-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { compactNumber, relativeTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { CreatorList } from "@/lib/types";

export interface ListSummary {
  list: CreatorList;
  avgSubscribers: number | null;
  avgViews: number | null;
  avgScore: number | null;
  countries: string[];
  withEmail: number;
  rising: number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/40 px-2 py-1.5">
      <div className="text-[13px] font-medium tabular">{value}</div>
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function ListsGrid({ summaries }: { summaries: ListSummary[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<CreatorList | null>(null);

  const needle = query.trim().toLowerCase();
  const filtered = summaries.filter(
    (s) =>
      s.list.name.toLowerCase().includes(needle) ||
      (s.list.description ?? "").toLowerCase().includes(needle)
  );

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/lists/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("lists.deletedToast", { name: deleteTarget?.name ?? "" }));
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("lists.searchPlaceholder")}
            className="h-9 pl-9"
          />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("lists.newList")}
        </Button>
      </div>

      {summaries.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title={t("lists.emptyDbTitle")}
          description={t("lists.emptyDbBody")}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("lists.createList")}
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title={t("lists.emptyTitle")}
          description={t("lists.emptyBody")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ list, ...stats }) => (
            <Card key={list.id} className="flex flex-col transition-colors hover:border-primary/30">
              <CardContent className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: list.color }}
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/lists/${list.id}`}
                        className="block truncate text-[14px] font-semibold text-foreground hover:underline"
                      >
                        {list.name}
                      </Link>
                      {list.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {list.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("lists.actionsFor", { name: list.name })}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link href={`/lists/${list.id}`}>
                          <ArrowRight />
                          {t("lists.openList")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/lists/${list.id}`}>
                          <Pencil />
                          {t("common.edit")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteTarget(list)}
                      >
                        <Trash2 />
                        {t("lists.deleteList")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  <Stat label={t("lists.statCreators")} value={String(list.memberCount)} />
                  <Stat
                    label={t("lists.statAvgSubs")}
                    value={stats.avgSubscribers === null ? "—" : compactNumber(stats.avgSubscribers)}
                  />
                  <Stat
                    label={t("lists.statAvgViews")}
                    value={stats.avgViews === null ? "—" : compactNumber(stats.avgViews)}
                  />
                  <Stat
                    label={t("lists.statAvgScore")}
                    value={stats.avgScore === null ? "—" : String(stats.avgScore)}
                  />
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[11px] text-muted-foreground">
                  <span>
                    {t("lists.withEmail", { count: stats.withEmail })} ·{" "}
                    {t("lists.risingCount", { count: stats.rising })}
                  </span>
                  <span>{t("common.updated", { time: relativeTime(list.updatedAt, locale) })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateListDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={t("lists.deleteTitle", { name: deleteTarget?.name ?? "" })}
        description={t("lists.deleteBody")}
        confirmLabel={t("lists.deleteList")}
        destructive
        onConfirm={() => deleteTarget && void remove(deleteTarget.id)}
      />
    </div>
  );
}

export function CreateListDialog({
  open,
  onOpenChange,
  creatorIds,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Seeds the new list with these creators. */
  creatorIds?: string[];
  onCreated?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, creatorIds }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create the list.");
      toast.success(t("lists.createdToast", { name: name.trim() }), {
        description: creatorIds?.length
          ? t("lists.createdWithCreators", { count: creatorIds.length })
          : t("lists.createdToastBody"),
      });
      setName("");
      setDescription("");
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
          <DialogTitle>{t("lists.createTitle")}</DialogTitle>
          <DialogDescription>{t("lists.createDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cl-name">{t("lists.nameLabel")}</Label>
            <Input
              id="cl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("lists.namePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-desc">{t("lists.descriptionLabel")}</Label>
            <Textarea
              id="cl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("lists.descriptionPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!name.trim() || saving} onClick={() => void submit()}>
            {t("lists.createList")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
