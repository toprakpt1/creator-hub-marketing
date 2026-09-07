"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useT } from "@/lib/i18n/provider";

export function NotFoundCopy() {
  const t = useT();
  return (
    <EmptyState
      icon={Compass}
      title={t("notFound.title")}
      description={t("notFound.body")}
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">{t("common.goToDashboard")}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/creators">{t("common.browseCreators")}</Link>
          </Button>
        </div>
      }
    />
  );
}
