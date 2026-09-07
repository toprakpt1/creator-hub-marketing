"use client";

import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import type { CampaignFunnel } from "@/lib/types";

const STAGES: { key: keyof CampaignFunnel; labelKey: string }[] = [
  { key: "added", labelKey: "campaigns.stageAdded" },
  { key: "qualified", labelKey: "campaigns.stageQualified" },
  { key: "contacted", labelKey: "campaigns.stageContacted" },
  { key: "replied", labelKey: "campaigns.stageReplied" },
  { key: "interested", labelKey: "campaigns.stageInterested" },
  { key: "accepted", labelKey: "campaigns.stageAccepted" },
  { key: "published", labelKey: "campaigns.stagePublished" },
];

/**
 * Stage counts come from member creators' real pipeline status. Stages past
 * qualification stay at zero until outreach exists — that is accurate rather
 * than a gap to fill with invented numbers.
 */
export function CampaignFunnelChart({ funnel }: { funnel: CampaignFunnel }) {
  const t = useT();
  const top = funnel.added || 1;

  return (
    <div className="space-y-1">
      {STAGES.map((stage, i) => {
        const value = funnel[stage.key];
        const prev = i === 0 ? null : funnel[STAGES[i - 1].key];
        // 0 out of 0 is not a 100% conversion — it is simply not measurable.
        const conversion = prev ? (value / prev) * 100 : null;
        const width = Math.max((value / top) * 100, 4);

        return (
          <div key={stage.key}>
            <div className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-xs text-muted-foreground sm:w-36">
                {t(stage.labelKey)}
              </div>
              <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-secondary/50">
                <div
                  className="flex h-full items-center rounded-md px-2.5 transition-all"
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(90deg, hsl(205 84% 45% / ${0.92 - i * 0.1}), hsl(205 84% 38% / ${0.78 - i * 0.09}))`,
                  }}
                >
                  <span className="text-xs font-semibold tabular text-white drop-shadow">
                    {value}
                  </span>
                </div>
              </div>
              <div className="w-14 shrink-0 text-right text-xs tabular text-muted-foreground">
                {conversion === null ? "—" : `${conversion.toFixed(0)}%`}
              </div>
            </div>
            {i < STAGES.length - 1 && (
              <div className="flex items-center gap-3 py-0.5">
                <div className="w-28 shrink-0 sm:w-36" />
                <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
