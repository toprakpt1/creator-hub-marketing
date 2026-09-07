"use client";

import { PageHeader } from "@/components/shared/page-header";
import { useT } from "@/lib/i18n/provider";

/**
 * Translated page header. Server pages keep their metadata and data selection
 * and hand the localisable strings to this client component as dictionary keys.
 */
export function PageIntro({
  titleKey,
  descriptionKey,
  actions,
  children,
}: {
  titleKey: string;
  descriptionKey?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const t = useT();
  return (
    <PageHeader
      title={t(titleKey)}
      description={descriptionKey ? t(descriptionKey) : undefined}
      actions={actions}
    >
      {children}
    </PageHeader>
  );
}

/** Inline translated text for small bits of copy inside server components. */
export function T({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  const t = useT();
  return <>{t(k, vars)}</>;
}
