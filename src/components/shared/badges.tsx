"use client";

import { Badge } from "@/components/ui/badge";
import { SimpleTooltip } from "@/components/ui/tooltip";
import {
  CREATOR_STATUS_META,
  EMAIL_STATUS_META,
  PLATFORM_META,
  scoreBand,
} from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import type { CreatorStatus, EmailStatus, Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CreatorStatusBadge({ status }: { status: CreatorStatus }) {
  const t = useT();
  return <Badge variant={CREATOR_STATUS_META[status].tone}>{t(`status.creator.${status}`)}</Badge>;
}

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  const t = useT();
  return <Badge variant={EMAIL_STATUS_META[status].tone}>{t(`status.email.${status}`)}</Badge>;
}

/** Platform pill; inactive platforms are visibly marked as not yet available. */
export function PlatformBadge({ platform }: { platform: Platform }) {
  const t = useT();
  const meta = PLATFORM_META[platform];
  return (
    <Badge variant={meta.active ? "secondary" : "muted"} className="gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
      {!meta.active && (
        <span className="text-[10px] opacity-80">· {t("platforms.comingSoon")}</span>
      )}
    </Badge>
  );
}

/**
 * Score pill. A creator with no analysed videos has no score yet — showing a
 * dash is honest, showing 0 would read as "bad".
 */
export function ScoreBadge({
  score,
  showLabel = true,
  className,
}: {
  score: number | null;
  showLabel?: boolean;
  className?: string;
}) {
  const t = useT();
  if (score === null) {
    return (
      <SimpleTooltip label={t("creators.notAnalyzedYet")}>
        <span className={cn("text-xs text-muted-foreground", className)}>—</span>
      </SimpleTooltip>
    );
  }
  const band = scoreBand(score);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular"
        style={{ backgroundColor: band.color + "22", color: band.color }}
      >
        {score}
      </span>
      {showLabel && (
        <span className="hidden text-xs text-muted-foreground lg:inline">
          {t(`scoreBands.${band.key}`)}
        </span>
      )}
    </span>
  );
}

/** The rising signal — computed, not stored per-creator as free text. */
export function RisingBadge({
  isRising,
  ratio,
  compact,
}: {
  isRising: boolean;
  ratio: number | null;
  /** Flame only — for table cells, where the word costs too much width. */
  compact?: boolean;
}) {
  const t = useT();
  if (!isRising) return null;
  return (
    <SimpleTooltip
      label={
        ratio !== null
          ? t("creators.risingTipWithRatio", { ratio: ratio.toFixed(2) })
          : t("creators.risingTip")
      }
    >
      <span>
        <Badge variant="warning" className="cursor-default gap-1">
          <span aria-hidden>🔥</span>
          <span className={compact ? "sr-only" : undefined}>{t("creators.rising")}</span>
        </Badge>
      </span>
    </SimpleTooltip>
  );
}

export function KeywordBadges({
  keywords,
  max = 2,
  className,
}: {
  keywords: string[];
  max?: number;
  className?: string;
}) {
  if (keywords.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const shown = keywords.slice(0, max);
  const rest = keywords.slice(max);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((k) => (
        <SimpleTooltip key={k} label={k}>
          <span>
            <Badge variant="outline" className="max-w-[90px] cursor-default truncate">
              {k}
            </Badge>
          </span>
        </SimpleTooltip>
      ))}
      {rest.length > 0 && (
        <SimpleTooltip label={rest.join(", ")}>
          <span>
            <Badge variant="muted" className="cursor-default">
              +{rest.length}
            </Badge>
          </span>
        </SimpleTooltip>
      )}
    </span>
  );
}
