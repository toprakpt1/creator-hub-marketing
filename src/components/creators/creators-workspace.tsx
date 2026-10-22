"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/shared/page-intro";
import { CreateCreatorDialog } from "@/components/creators/create-creator-dialog";
import { CreatorsExplorer } from "@/components/creators/creators-explorer";
import { useT } from "@/lib/i18n/provider";
import type { Creator } from "@/lib/types";

export interface CreatorsWorkspaceStats {
  total: number;
  analyzed: number;
  rising: number;
  withEmail: number;
}

/**
 * Client-side shell for the Creators page: it owns the manual-entry dialog so
 * both the header and the empty state can open the same instance, and nudges
 * the table to "recently discovered" after a successful add.
 */
export function CreatorsWorkspace({
  creators,
  stats,
}: {
  creators: Creator[];
  stats: CreatorsWorkspaceStats;
}) {
  const t = useT();
  const [addOpen, setAddOpen] = React.useState(false);
  const [addedNonce, setAddedNonce] = React.useState(0);

  return (
    <div className="space-y-5">
      <PageIntro titleKey="creators.title" descriptionKey="creators.subtitle"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus />
            {t("creators.addManual")}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>{t("creators.statInWorkspace", { count: stats.total })}</span>
          <span>{t("creators.statAnalyzed", { count: stats.analyzed })}</span>
          <span>{t("creators.statRising", { count: stats.rising })}</span>
          <span>{t("creators.statWithContact", { count: stats.withEmail })}</span>
        </div>
      </PageIntro>

      <CreatorsExplorer
        creators={creators}
        addedNonce={addedNonce}
        onAddManual={() => setAddOpen(true)}
      />

      <CreateCreatorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => setAddedNonce((n) => n + 1)}
      />
    </div>
  );
}
