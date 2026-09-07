"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Search, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CreatorAvatar } from "@/components/shared/creator-avatar";
import { MAIN_NAV } from "@/components/layout/nav-config";
import { countryFlagFor } from "@/lib/constants";
import { compactNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Global search over saved creators. The list is fetched once when the palette
 * first opens and filtered in memory — the database is small and this keeps
 * typing instant without a request per keystroke.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creators, setCreators] = React.useState<Creator[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();
  const t = useT();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open || creators !== null || loading) return;
    setLoading(true);
    fetch("/api/creators")
      .then((r) => r.json())
      .then((d: { creators?: Creator[] }) => setCreators(d.creators ?? []))
      .catch(() => setCreators([]))
      .finally(() => setLoading(false));
  }, [open, creators, loading]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !creators) return [];
    return creators
      .map((c) => {
        let matchedOn: string | null = null;
        if (c.name.toLowerCase().includes(q)) matchedOn = "Name";
        else if ((c.handle ?? "").toLowerCase().includes(q)) matchedOn = "Username";
        else if ((c.country ?? "").toLowerCase().includes(q)) matchedOn = "Country";
        else if (c.discoveredKeywords.some((k) => k.toLowerCase().includes(q)))
          matchedOn = "Keyword";
        else if ((c.email ?? "").toLowerCase().includes(q)) matchedOn = "Email";
        return matchedOn ? { creator: c, matchedOn } : null;
      })
      .filter((x): x is { creator: Creator; matchedOn: string } => x !== null)
      .slice(0, 8);
  }, [creators, query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background/40 px-3 text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          className
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">{t("topbar.searchPlaceholder")}</span>
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t("topbar.searchDialogPlaceholder")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <CommandEmpty>{t("topbar.noMatches", { query })}</CommandEmpty>
          )}

          {!query && (
            <CommandGroup heading={t("topbar.jumpTo")}>
              {MAIN_NAV.map((item) => (
                <CommandItem key={item.href} value={item.href} onSelect={() => go(item.href)}>
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {t(item.labelKey)}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.length > 0 && (
            <CommandGroup heading={t("topbar.groupCreators")}>
              {results.map(({ creator, matchedOn }) => (
                <CommandItem
                  key={creator.id}
                  value={creator.id}
                  onSelect={() => go(`/creators/${creator.id}`)}
                >
                  <CreatorAvatar
                    name={creator.name}
                    seed={creator.id}
                    imageUrl={creator.thumbnailUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{creator.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {creator.handle ? `${creator.handle} · ` : ""}
                      {creator.country
                        ? `${countryFlagFor(creator.country)} ${creator.country} · `
                        : ""}
                      {creator.subscriberCount === null
                        ? t("creators.hidden")
                        : t("creators.subsCount", {
                            count: compactNumber(creator.subscriberCount),
                          })}
                    </span>
                  </div>
                  <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {t(`topbar.matched${matchedOn}`)}
                  </span>
                </CommandItem>
              ))}
              <CommandItem value="all-creators" onSelect={() => go("/creators")}>
                <Users className="h-4 w-4 text-muted-foreground" />
                {t("topbar.seeAllMatching", { query })}
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
