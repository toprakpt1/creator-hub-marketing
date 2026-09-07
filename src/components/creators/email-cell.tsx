"use client";

import * as React from "react";
import { Check, Loader2, Mail, MailX, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { patchCreator } from "@/components/creators/creator-actions";
import { useT } from "@/lib/i18n/provider";
import type { Creator } from "@/lib/types";

/**
 * Click-to-edit email straight in the table.
 *
 * The app never discovers emails by itself, so this is the one place an
 * address enters the database — pasted in by a person who looked it up. The
 * write goes through the API like every other mutation, and the source is
 * recorded as `manual` so it is always clear where the address came from.
 */
export function EmailCell({
  creator,
  onChanged,
}: {
  creator: Creator;
  onChanged?: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(creator.email ?? "");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // A refresh can bring a different address in under us; keep the draft in step
  // whenever we are not mid-edit.
  React.useEffect(() => {
    if (!editing) setValue(creator.email ?? "");
  }, [creator.email, editing]);

  React.useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const open = () => {
    setValue(creator.email ?? "");
    setEditing(true);
  };

  const cancel = () => {
    setValue(creator.email ?? "");
    setEditing(false);
  };

  const save = async () => {
    const next = value.trim();
    if (next === (creator.email ?? "")) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await patchCreator(creator.id, { email: next || null, emailSource: "manual" });
      toast.success(
        next
          ? t("creators.emailSaved", { name: creator.name })
          : t("creators.emailCleared", { name: creator.name })
      );
      setEditing(false);
      onChanged?.();
    } catch (e) {
      // The API validates the address, so keep the row open on a bad paste.
      toast.error((e as Error).message);
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") cancel();
          }}
          // Losing focus to our own buttons must not cancel the edit.
          onBlur={(e) => {
            if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) cancel();
          }}
          placeholder={t("creators.emailPlaceholder")}
          aria-label={t("creators.emailFor", { name: creator.name })}
          className="h-7 w-[150px] text-[13px]"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void save()}
          disabled={saving}
          aria-label={t("common.save")}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
          disabled={saving}
          aria-label={t("common.cancel")}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (creator.email) {
    return (
      <SimpleTooltip label={t("creators.emailEditHint")}>
        <button
          type="button"
          onClick={open}
          className="flex max-w-[120px] items-center gap-1.5 rounded px-1 py-0.5 text-left text-[13px] transition-colors hover:bg-secondary"
        >
          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{creator.email}</span>
        </button>
      </SimpleTooltip>
    );
  }

  return (
    <SimpleTooltip label={t("creators.emailAddHint")}>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <MailX className="h-3.5 w-3.5" />
        {t("common.none")}
      </button>
    </SimpleTooltip>
  );
}
