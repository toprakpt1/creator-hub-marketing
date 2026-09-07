"use client";

import Link from "next/link";
import { Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useT } from "@/lib/i18n/provider";

/** "Nothing here yet — go discover" empty state, translated. */
export function EmptyDiscoverState({
  titleKey,
  bodyKey,
}: {
  titleKey: string;
  bodyKey: string;
}) {
  const t = useT();
  return (
    <EmptyState
      icon={Radar}
      title={t(titleKey)}
      description={t(bodyKey)}
      action={
        <Button size="sm" asChild>
          <Link href="/discover">
            <Radar />
            {t("dashboard.runDiscovery")}
          </Link>
        </Button>
      }
    />
  );
}
