"use client";

import Link from "next/link";
import { Radar, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";

/**
 * Placeholder for surfaces that are designed but deliberately not wired up in
 * phase 1. Shows what the screen will do rather than pretending to have data.
 */
export function PhaseNotice({
  titleKey,
  bodyKey,
  bulletKeys = [],
}: {
  titleKey: string;
  bodyKey: string;
  bulletKeys?: string[];
}) {
  const t = useT();
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div className="max-w-md">
          <p className="text-sm font-medium text-foreground">{t(titleKey)}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t(bodyKey)}</p>
        </div>
        {bulletKeys.length > 0 && (
          <ul className="mx-auto max-w-md space-y-1 text-left text-xs text-muted-foreground">
            {bulletKeys.map((k) => (
              <li key={k} className="flex gap-2">
                <span className="text-primary">·</span>
                {t(k)}
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/discover">
            <Radar />
            {t("phase.goDiscover")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
