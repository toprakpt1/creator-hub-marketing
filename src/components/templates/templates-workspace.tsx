"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Eye,
  ImagePlus,
  Languages,
  Link2,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { isImageMimeType, MAX_IMAGE_BYTES } from "@/lib/outreach/markup";
import {
  renderBodyHtml,
  renderBodyPlainText,
  renderTemplate,
  TEMPLATE_VARIABLES,
} from "@/lib/outreach/render";
import { useGameSettings } from "@/lib/use-game-settings";
import type { Creator, EmailTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TextRange {
  start: number;
  end: number;
}

/** Normalizes a typed address the same way the sender will. */
function absoluteHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

function altFromUrl(value: string): string {
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`).hostname;
  } catch {
    return "image";
  }
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
  const game = useGameSettings();

  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState(templates[0]?.id ?? "");
  const [editing, setEditing] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<EmailTemplate | null>(null);
  const [draft, setDraft] = React.useState<{ subject: string; body: string; name: string } | null>(
    null
  );

  const bodyRef = React.useRef<HTMLTextAreaElement | null>(null);
  /** Selection captured when a dialog opens; the dialog steals focus. */
  const [insertRange, setInsertRange] = React.useState<TextRange | null>(null);

  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkText, setLinkText] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");

  const [imageOpen, setImageOpen] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState("");
  const [imageAlt, setImageAlt] = React.useState("");
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imageBusy, setImageBusy] = React.useState(false);

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

  function currentSelection(): TextRange | null {
    const el = bodyRef.current;
    if (!el) return null;
    return { start: el.selectionStart, end: el.selectionEnd };
  }

  /** Inserts at the caret (or a remembered range) instead of appending. */
  function insertAt(snippet: string, range?: TextRange | null) {
    const el = bodyRef.current;
    const body = current.body;
    const start = range?.start ?? el?.selectionStart ?? body.length;
    const end = range?.end ?? el?.selectionEnd ?? body.length;
    setDraft({ ...current, body: `${body.slice(0, start)}${snippet}${body.slice(end)}` });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + snippet.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function openLinkDialog() {
    const range = currentSelection();
    setInsertRange(range);
    setLinkText(
      range && range.end > range.start ? current.body.slice(range.start, range.end).trim() : ""
    );
    setLinkUrl("");
    setLinkOpen(true);
  }

  function insertLink() {
    const href = absoluteHttpUrl(linkUrl);
    if (!href) {
      toast.error(t("templates.invalidUrl"));
      return;
    }
    const label = linkText.trim() || linkUrl.trim();
    insertAt(`[${label.replace(/[[\]]/g, " ").trim()}](${linkUrl.trim()})`, insertRange);
    setLinkOpen(false);
  }

  function openImageDialog() {
    setInsertRange(currentSelection());
    setImageUrl("");
    setImageAlt("");
    setImageFile(null);
    setImageOpen(true);
  }

  async function insertImage() {
    if (!selected) return;

    if (imageFile) {
      if (!isImageMimeType(imageFile.type)) {
        toast.error(t("templates.imageTypeError"));
        return;
      }
      if (imageFile.size > MAX_IMAGE_BYTES) {
        toast.error(t("templates.imageTooLarge"));
        return;
      }

      setImageBusy(true);
      try {
        const form = new FormData();
        form.append("file", imageFile);
        const res = await fetch(`/api/templates/${selected.id}/assets`, {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as { asset?: { id: string }; error?: string };
        if (!res.ok || !data.asset) {
          throw new Error(data.error ?? t("templates.imageUploadError"));
        }
        const alt = (imageAlt.trim() || imageFile.name).replace(/[[\]]/g, " ").trim();
        insertAt(`\n\n![${alt}](asset:${data.asset.id})\n\n`, insertRange);
        toast.success(t("templates.imageUploaded"));
        setImageOpen(false);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setImageBusy(false);
      }
      return;
    }

    const href = absoluteHttpUrl(imageUrl);
    if (!href) {
      toast.error(t("templates.invalidUrl"));
      return;
    }
    const alt = (imageAlt.trim() || altFromUrl(href)).replace(/[[\]]/g, " ").trim();
    insertAt(`\n\n![${alt}](${imageUrl.trim()})\n\n`, insertRange);
    setImageOpen(false);
  }

  async function createTemplate() {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: t("templates.newTemplateName"),
          language: "English",
          subject: t("templates.starterSubject", { game: game.name }),
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
                    onSelect={() =>
                      void copyWithToast(
                        renderBodyPlainText(current.body),
                        t("templates.copyBody")
                      )
                    }
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="tpl-body">{t("templates.body")}</Label>
                    {editing && (
                      <div className="flex items-center gap-1.5">
                        <Button type="button" variant="outline" size="sm" onClick={openLinkDialog}>
                          <Link2 />
                          {t("templates.insertLink")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={openImageDialog}>
                          <ImagePlus />
                          {t("templates.insertImage")}
                        </Button>
                      </div>
                    )}
                  </div>
                  {editing ? (
                    <Textarea
                      id="tpl-body"
                      ref={bodyRef}
                      value={current.body}
                      onChange={(e) => setDraft({ ...current, body: e.target.value })}
                      className="min-h-[340px] font-sans text-[13px] leading-relaxed"
                    />
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto rounded-md border border-border px-3 py-3">
                      <Highlighted body={current.body} />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {t("templates.markupHint")}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t("templates.variables")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <SimpleTooltip key={v.token} label={t(`templates.${v.key}`)}>
                        <button
                          onClick={() => {
                            if (!editing) return;
                            insertAt(v.token);
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
                        {renderTemplate(current.subject, sampleCreator, game)}
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
                  <div
                    className="max-h-[420px] overflow-y-auto px-4 py-4 text-[13px] leading-relaxed text-foreground [&_img]:rounded-md"
                    dangerouslySetInnerHTML={{
                      __html: renderBodyHtml(renderTemplate(current.body, sampleCreator, game), {
                        assetSrc: (id) => `/api/assets/${id}`,
                      }),
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {sampleCreator ? t("templates.previewNote") : t("templates.previewNoteEmpty")}
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("templates.insertLink")}</DialogTitle>
            <DialogDescription>{t("templates.linkDialogBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-link-text">{t("templates.linkText")}</Label>
              <Input
                id="tpl-link-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder={t("templates.linkTextPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-link-url">{t("templates.linkUrl")}</Label>
              <Input
                id="tpl-link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://store.steampowered.com/..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={insertLink} disabled={!linkUrl.trim()}>
              <Link2 />
              {t("templates.insert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={imageOpen}
        onOpenChange={(v) => {
          if (!imageBusy) setImageOpen(v);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("templates.insertImage")}</DialogTitle>
            <DialogDescription>{t("templates.imageDialogBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-image-file">{t("templates.uploadFromComputer")}</Label>
              <Input
                id="tpl-image-file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImageFile(file);
                  if (file) setImageUrl("");
                }}
              />
              <p className="text-[11px] text-muted-foreground">{t("templates.imageLimits")}</p>
            </div>

            <p className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("templates.orUseUrl")}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-image-url">{t("templates.imageUrl")}</Label>
              <Input
                id="tpl-image-url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (e.target.value) setImageFile(null);
                }}
                placeholder="https://.../screenshot.png"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-image-alt">{t("templates.imageAlt")}</Label>
              <Input
                id="tpl-image-alt"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder={t("templates.imageAltPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageOpen(false)} disabled={imageBusy}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void insertImage()}
              disabled={imageBusy || (!imageFile && !imageUrl.trim())}
            >
              {imageBusy ? <Loader2 className="animate-spin" /> : <Upload />}
              {imageBusy ? t("templates.uploading") : t("templates.insert")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
