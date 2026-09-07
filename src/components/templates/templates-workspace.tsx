"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Eye,
  Languages,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/creators/creator-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { copyWithToast } from "@/lib/clipboard";
import { relativeTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { Creator, EmailTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Variables filled from a real creator record at render time. */
const VARIABLES = [
  { token: "{{creator_name}}", key: "varCreatorName" },
  { token: "{{channel_name}}", key: "varChannelName" },
  { token: "{{subscribers}}", key: "varSubscribers" },
  { token: "{{average_views}}", key: "varAverageViews" },
  { token: "{{country}}", key: "varCountry" },
  { token: "{{keyword}}", key: "varKeyword" },
  { token: "{{game_name}}", key: "varGameName" },
  { token: "{{steam_link}}", key: "varSteamLink" },
];

const GAME_NAME = "Chest Blade";
const STEAM_LINK = "https://store.steampowered.com/app/chestblade";

/** Replaces {{tokens}}; unknown ones are left visible rather than blanked. */
function render(text: string, creator: Creator | null): string {
  const map: Record<string, string> = {
    creator_name: creator?.name ?? "there",
    channel_name: creator?.handle ?? creator?.name ?? "your channel",
    subscribers:
      creator?.subscriberCount != null ? creator.subscriberCount.toLocaleString("en-US") : "—",
    average_views:
      creator?.averageViews != null ? creator.averageViews.toLocaleString("en-US") : "—",
    country: creator?.country ?? "your region",
    keyword: creator?.discoveredKeywords[0] ?? "indie games",
    game_name: GAME_NAME,
    steam_link: STEAM_LINK,
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (full, k: string) => map[k] ?? full);
}

function Highlighted({ body }: { body: string }) {
  const parts: { text: string; isVar: boolean }[] = [];
  const re = /\{\{\s*\w+\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push({ text: body.slice(last, m.index), isVar: false });
    parts.push({ text: m[0], isVar: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last), isVar: false });

  return (
    <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-muted-foreground">
      {parts.map((p, i) =>
        p.isVar ? (
          <span key={i} className="rounded bg-primary/15 px-1 py-0.5 font-medium text-primary">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </pre>
  );
}

export function TemplatesWorkspace({
  templates,
  sampleCreator,
}: {
  templates: EmailTemplate[];
  /** A real saved creator used for the preview, when one exists. */
  sampleCreator: Creator | null;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState(templates[0]?.id ?? "");
  const [editing, setEditing] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<EmailTemplate | null>(null);
  const [draft, setDraft] = React.useState<{ subject: string; body: string; name: string } | null>(
    null
  );

  const needle = query.trim().toLowerCase();
  const filtered = templates.filter(
    (tpl) =>
      tpl.name.toLowerCase().includes(needle) || tpl.language.toLowerCase().includes(needle)
  );

  const selected = templates.find((tpl) => tpl.id === selectedId) ?? filtered[0] ?? templates[0];
  const current = draft ?? {
    name: selected?.name ?? "",
    subject: selected?.subject ?? "",
    body: selected?.body ?? "",
  };

  async function createTemplate() {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t("templates.newTemplateName"),
          language: "English",
          subject: t("templates.starterSubject", { game: GAME_NAME }),
          body: t("templates.starterBody"),
        }),
      });
      const data = (await res.json()) as { template?: EmailTemplate; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create the template.");
      toast.success(t("templates.createdToast"));
      if (data.template) setSelectedId(data.template.id);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function save() {
    if (!selected) return;
    try {
      const res = await fetch(`/api/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
      });
      if (!res.ok) throw new Error("Could not save the template.");
      toast.success(t("templates.savedToast"));
      setEditing(false);
      setDraft(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(id: string, name: string) {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("templates.deletedToast", { name }));
      setDeleteTarget(null);
      setSelectedId("");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title={t("templates.emptyDbTitle")}
        description={t("templates.emptyDbBody")}
        action={
          <Button size="sm" onClick={() => void createTemplate()}>
            <Plus />
            {t("templates.newTemplate")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Template list */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("templates.searchPlaceholder")}
              className="h-9 pl-9"
            />
          </div>
          <Button
            size="icon"
            aria-label={t("templates.newTemplate")}
            onClick={() => void createTemplate()}
          >
            <Plus />
          </Button>
        </div>

        <div className="space-y-1.5">
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => {
                setSelectedId(tpl.id);
                setEditing(false);
                setDraft(null);
              }}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                selected?.id === tpl.id
                  ? "border-primary/50 bg-primary/[0.06]"
                  : "border-border hover:bg-secondary/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{tpl.name}</span>
                <Badge variant="muted" className="gap-1">
                  <Languages className="h-3 w-3" />
                  {tpl.language}
                </Badge>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{tpl.subject}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {t("common.updated", { time: relativeTime(tpl.updatedAt, locale) })}
              </p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
              {t("templates.noMatches")}
            </p>
          )}
        </div>
      </div>

      {/* Editor / preview */}
      {selected && (
        <Card className="min-w-0">
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-[15px]">{selected.name}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {selected.language} ·{" "}
                {t("common.updated", { time: relativeTime(selected.updatedAt, locale) })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {editing ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setDraft(null);
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button size="sm" onClick={() => void save()}>
                    <Save />
                    {t("common.save")}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraft({
                      name: selected.name,
                      subject: selected.subject,
                      body: selected.body,
                    });
                    setEditing(true);
                  }}
                >
                  <Pencil />
                  {t("common.edit")}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("templates.templateActions", { name: selected.name })}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onSelect={() => void copyWithToast(current.body, t("templates.copyBody"))}
                  >
                    <Copy />
                    {t("templates.copyBody")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteTarget(selected)}
                  >
                    <Trash2 />
                    {t("templates.deleteTemplate")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Tabs defaultValue="editor">
              <TabsList>
                <TabsTrigger value="editor">
                  <Pencil className="h-3.5 w-3.5" />
                  {t("templates.tabTemplate")}
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="h-3.5 w-3.5" />
                  {t("templates.tabPreview")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="space-y-3">
                {editing && (
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-name">{t("templates.nameLabel")}</Label>
                    <Input
                      id="tpl-name"
                      value={current.name}
                      onChange={(e) => setDraft({ ...current, name: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-subject">{t("templates.subject")}</Label>
                  {editing ? (
                    <Input
                      id="tpl-subject"
                      value={current.subject}
                      onChange={(e) => setDraft({ ...current, subject: e.target.value })}
                    />
                  ) : (
                    <div className="rounded-md border border-border px-3 py-2">
                      <Highlighted body={current.subject} />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-body">{t("templates.body")}</Label>
                  {editing ? (
                    <Textarea
                      id="tpl-body"
                      value={current.body}
                      onChange={(e) => setDraft({ ...current, body: e.target.value })}
                      className="min-h-[340px] font-sans text-[13px] leading-relaxed"
                    />
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto rounded-md border border-border px-3 py-3">
                      <Highlighted body={current.body} />
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t("templates.variables")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map((v) => (
                      <SimpleTooltip key={v.token} label={t(`templates.${v.key}`)}>
                        <button
                          onClick={() => {
                            if (!editing) return;
                            setDraft({ ...current, body: current.body + v.token });
                            toast.success(t("templates.variableInserted", { token: v.token }));
                          }}
                          className={cn(
                            "rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-[11px] text-primary transition-colors",
                            editing ? "hover:border-primary/50" : "cursor-default opacity-80"
                          )}
                        >
                          {v.token}
                        </button>
                      </SimpleTooltip>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {editing ? t("templates.insertHint") : t("templates.editHint")}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="space-y-3">
                <div className="rounded-lg border border-border">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">
                        {render(current.subject, sampleCreator)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {sampleCreator
                          ? t("templates.previewTo", {
                              name: sampleCreator.name,
                              email: sampleCreator.email ?? t("templates.noEmail"),
                            })
                          : t("templates.previewNoCreator")}
                      </div>
                    </div>
                  </div>
                  <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap px-4 py-4 font-sans text-[13px] leading-relaxed text-foreground">
                    {render(current.body, sampleCreator)}
                  </pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  {sampleCreator ? t("templates.previewNote") : t("templates.previewNoteEmpty")}
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={t("templates.deleteTitle", { name: deleteTarget?.name ?? "" })}
        description={t("templates.deleteBody")}
        confirmLabel={t("templates.deleteTemplate")}
        destructive
        onConfirm={() => deleteTarget && void remove(deleteTarget.id, deleteTarget.name)}
      />
    </div>
  );
}
