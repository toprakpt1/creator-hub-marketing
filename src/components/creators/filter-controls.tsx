"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  /** Optional leading glyph (flag emoji, platform colour dot…). */
  prefix?: React.ReactNode;
  count?: number;
}

/**
 * Multi-select facet in a popover, with a search box once the list gets long.
 * Built to stay usable when the option list is hundreds of entries.
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  searchable,
  align = "start",
  className,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
  align?: "start" | "end";
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const t = useT();
  const showSearch = searchable ?? options.length > 8;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
    );
  };

  const summary =
    selected.length === 0
      ? null
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1"
        : `${selected.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 border-dashed text-[13px]",
            selected.length > 0 && "border-solid border-primary/40 bg-primary/5",
            className
          )}
        >
          <span className="text-muted-foreground">{label}</span>
          {summary && <span className="max-w-[120px] truncate font-medium">{summary}</span>}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        {showSearch && (
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("creators.searchFacet", { label })}
              className="h-9 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t("creators.noFacetMatches")}</p>
          )}
          {filtered.map((o) => {
            const active = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-accent"
              >
                <Checkbox checked={active} className="pointer-events-none" tabIndex={-1} />
                {o.prefix}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.count !== undefined && (
                  <span className="text-xs tabular text-muted-foreground">{o.count}</span>
                )}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-border p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs"
              onClick={() => onChange([])}
            >
              {t("creators.clearFacet", { label })}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Single-choice segmented control used for small option sets. */
export function SegmentedFilter<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <div className="inline-flex rounded-md border border-border p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              value === o.value
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Numeric threshold entered in a popover — min avg views, engagement, score. */
export function NumberFilter({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  presets = [],
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  placeholder?: string;
  presets?: number[];
}) {
  const [draft, setDraft] = React.useState(value === null ? "" : String(value));
  const t = useT();

  React.useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  const commit = () => {
    const n = Number(draft);
    onChange(draft.trim() === "" || Number.isNaN(n) ? null : n);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 border-dashed text-[13px]",
            value !== null && "border-solid border-primary/40 bg-primary/5"
          )}
        >
          <span className="text-muted-foreground">{label}</span>
          {value !== null && (
            <span className="font-medium tabular">
              ≥ {value}
              {suffix}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 space-y-2">
        <p className="text-xs text-muted-foreground">{t("creators.minimumOf", { label })}</p>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            placeholder={placeholder}
            inputMode="numeric"
            className="h-8"
          />
          <Button size="icon-sm" onClick={commit} aria-label={t("creators.apply")}>
            <Check />
          </Button>
        </div>
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {presets.map((p) => (
              <Button
                key={p}
                variant="secondary"
                size="xs"
                onClick={() => onChange(p)}
                className="tabular"
              >
                {p}
                {suffix}
              </Button>
            ))}
          </div>
        )}
        {value !== null && (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onChange(null)}>
            <X className="h-3 w-3" />
            {t("common.reset")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
