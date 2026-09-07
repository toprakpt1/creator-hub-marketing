"use client";

import { SimpleTooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { ALL_PLATFORMS, PLATFORM_META } from "@/lib/constants";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Platform availability strip. Inactive platforms stay visible so the roadmap
 * is legible, but they are non-interactive and clearly marked.
 */
export function PlatformStatusRow({ className }: { className?: string }) {
  const t = useT();
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {ALL_PLATFORMS.map((p) => {
        const meta = PLATFORM_META[p];
        const chip = (
          <span
            aria-disabled={!meta.active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
              meta.active
                ? "border-success/40 bg-success/10 text-foreground"
                : "cursor-not-allowed border-dashed border-border text-muted-foreground opacity-70"
            )}
          >
            <PlatformIcon platform={p} className="h-3.5 w-3.5" colored={meta.active} />
            {meta.label}
            <Badge variant={meta.active ? "success" : "muted"} className="ml-0.5">
              {meta.active ? t("platforms.active") : t("platforms.comingSoon")}
            </Badge>
          </span>
        );

        return meta.active ? (
          <span key={p}>{chip}</span>
        ) : (
          <SimpleTooltip key={p} label={t("platforms.comingSoonTip", { platform: meta.label })}>
            {chip}
          </SimpleTooltip>
        );
      })}
    </div>
  );
}
