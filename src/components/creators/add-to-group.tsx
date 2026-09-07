"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { CreateListDialog } from "@/components/lists/list-cards";
import { CreateCampaignDialog } from "@/components/campaigns/campaign-cards";
import { useT } from "@/lib/i18n/provider";
import type { Campaign, CreatorList } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Add to list" / "Add to campaign" pickers. Both fetch their options when
 * opened so a list created a moment ago is immediately selectable.
 */
function useGroups<T>(open: boolean, url: string, pick: (data: unknown) => T[]) {
  const [items, setItems] = React.useState<T[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => setItems(pick(d)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  return { items, loading, reload: load };
}

export function AddToListDialog({
  open,
  onOpenChange,
  creatorIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorIds: string[];
  onDone?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const { items, loading, reload } = useGroups<CreatorList>(open, "/api/lists", (d) =>
    ((d as { lists?: CreatorList[] }).lists ?? [])
  );

  async function submit() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/lists/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addCreatorIds: creatorIds }),
      });
      const data = (await res.json()) as { added?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add to the list.");
      const list = items?.find((l) => l.id === selected);
      toast.success(t("toast.addedToList", { name: list?.name ?? "" }), {
        description: t("toast.addedToListBody", { count: data.added ?? 0 }),
      });
      onOpenChange(false);
      onDone?.();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogs.addToListTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.addToListBody", { count: creatorIds.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {loading && <p className="py-6 text-center text-xs text-muted-foreground">{t("common.loading")}</p>}
            {!loading && items?.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                {t("dialogs.noListsYet")}
              </p>
            )}
            {items?.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelected(l.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                  selected === l.id
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-secondary/50"
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{l.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t("dialogs.creatorsCount", { count: l.memberCount })}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("lists.newList")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={!selected} onClick={() => void submit()}>
                <ListPlus />
                {t("creators.addToList")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateListDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        creatorIds={creatorIds}
        onCreated={() => {
          reload();
          onOpenChange(false);
          onDone?.();
        }}
      />
    </>
  );
}

export function AddToCampaignDialog({
  open,
  onOpenChange,
  creatorIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  creatorIds: string[];
  onDone?: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const { items, loading, reload } = useGroups<Campaign>(open, "/api/campaigns", (d) =>
    ((d as { campaigns?: Campaign[] }).campaigns ?? [])
  );

  async function submit() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/campaigns/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addCreatorIds: creatorIds }),
      });
      const data = (await res.json()) as { added?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add to the campaign.");
      const campaign = items?.find((c) => c.id === selected);
      toast.success(t("toast.addedToCampaign", { name: campaign?.name ?? "" }), {
        description: t("toast.addedToCampaignBody", { count: data.added ?? 0 }),
      });
      onOpenChange(false);
      onDone?.();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogs.addToCampaignTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.addToCampaignBody", { count: creatorIds.length })}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {loading && <p className="py-6 text-center text-xs text-muted-foreground">{t("common.loading")}</p>}
            {!loading && items?.length === 0 && (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                {t("dialogs.noCampaignsYet")}
              </p>
            )}
            {items?.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                  selected === c.id
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-secondary/50"
                )}
              >
                <Megaphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t(`status.campaign.${c.status}`)} ·{" "}
                    {t("dialogs.creatorsCount", { count: c.memberCount })}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("campaigns.newCampaign")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={!selected} onClick={() => void submit()}>
                <Megaphone />
                {t("creators.addToCampaign")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        creatorIds={creatorIds}
        onCreated={() => {
          reload();
          onOpenChange(false);
          onDone?.();
        }}
      />
    </>
  );
}
