"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Copy,
  ExternalLink,
  ListPlus,
  Loader2,
  Mail,
  Megaphone,
  Pencil,
  Send,
  Trash2,
  Youtube,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { CreatorAvatar } from "@/components/shared/creator-avatar";
import {
  CreatorStatusBadge,
  EmailStatusBadge,
  KeywordBadges,
  RisingBadge,
  ScoreBadge,
} from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { AddToCampaignDialog, AddToListDialog } from "@/components/creators/add-to-group";
import { SendEmailDialog } from "@/components/outreach/send-email-dialog";
import {
  analyzeCreatorRequest,
  channelUrl,
  ConfirmDialog,
  patchCreator,
} from "@/components/creators/creator-actions";
import {
  CREATOR_STATUSES,
  EMAIL_SOURCES,
  countryFlagFor,
  scoreBand,
} from "@/lib/constants";
import { copyWithToast } from "@/lib/clipboard";
import { compactNumber, formatDate, fullNumber, relativeTime } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { Campaign, Creator, CreatorList, CreatorVideo, EmailSource } from "@/lib/types";

/** Metric tile that renders an em dash rather than a fabricated zero. */
function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

const dash = (v: number | null, fmt: (n: number) => string = compactNumber) =>
  v === null ? "—" : fmt(v);

export function CreatorDetail({
  creator: initial,
  videos: initialVideos,
  lists,
  campaigns,
}: {
  creator: Creator;
  videos: CreatorVideo[];
  lists: CreatorList[];
  campaigns: Campaign[];
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const [creator, setCreator] = React.useState(initial);
  const [videos, setVideos] = React.useState(initialVideos);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [campaignOpen, setCampaignOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [editingEmail, setEditingEmail] = React.useState(false);
  const [emailDraft, setEmailDraft] = React.useState(creator.email ?? "");
  const [emailSource, setEmailSource] = React.useState<EmailSource>(
    creator.emailSource === "none" ? "manual" : creator.emailSource
  );
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const url = channelUrl(creator);
  const band = creator.creatorScore !== null ? scoreBand(creator.creatorScore) : null;

  async function analyze() {
    setAnalyzing(true);
    const id = toast.loading(t("creators.analyzing", { name: creator.name }));
    try {
      const res = await fetch(`/api/creators/${creator.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoCount: 10 }),
      });
      const data = (await res.json()) as {
        creator?: Creator;
        videos?: CreatorVideo[];
        videosAnalyzed?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t("discover.searchFailed"));
      if (data.creator) setCreator(data.creator);
      if (data.videos) setVideos(data.videos);
      toast.success(t("creators.analyzeDone", { count: data.videosAnalyzed ?? 0 }), {
        id,
        description: t("creators.analyzeCost"),
      });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message, { id });
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveEmail(next: string | null) {
    try {
      const data = (await patchCreator(creator.id, {
        email: next,
        emailSource: next ? emailSource : "none",
      })) as { creator?: Creator };
      if (data.creator) setCreator(data.creator);
      setEditingEmail(false);
      toast.success(next ? t("creatorDetail.emailSaved") : t("creatorDetail.emailRemoved"));
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function changeStatus(status: Creator["status"]) {
    try {
      const data = (await patchCreator(creator.id, { status })) as { creator?: Creator };
      if (data.creator) setCreator(data.creator);
      toast.success(t("creatorDetail.statusChanged"));
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href="/creators"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("creatorDetail.backToCreators")}
      </Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <CreatorAvatar
              name={creator.name}
              seed={creator.id}
              imageUrl={creator.thumbnailUrl}
              size="xl"
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 className="text-xl font-semibold tracking-tight">{creator.name}</h1>
                <CreatorStatusBadge status={creator.status} />
                <RisingBadge isRising={creator.isRising} ratio={creator.viewToSubscriberRatio} />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                {creator.handle && <span className="font-mono">{creator.handle}</span>}
                <span className="inline-flex items-center gap-1.5">
                  <Youtube className="h-3.5 w-3.5" style={{ color: "#ef4444" }} />
                  YouTube
                </span>
                {creator.country && (
                  <span>
                    <span className="mr-1" aria-hidden>
                      {countryFlagFor(creator.country)}
                    </span>
                    {creator.country}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {t("creatorDetail.discovered", { time: relativeTime(creator.discoveredAt, locale) })}
                </span>
                {creator.videosSyncedAt && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span>
                      {t("creatorDetail.analyzedAt", {
                        time: relativeTime(creator.videosSyncedAt, locale),
                      })}
                    </span>
                  </>
                )}
              </div>

              <KeywordBadges keywords={creator.discoveredKeywords} max={6} />
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("creatorDetail.creatorScore")}
                </div>
                <div className="text-xs" style={{ color: band?.color }}>
                  {band ? t(`scoreBands.${band.key}`) : t("creators.notAnalyzedYet")}
                </div>
              </div>
              <ScoreBadge score={creator.creatorScore} showLabel={false} className="scale-125" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {url && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink />
                    {t("creatorDetail.openChannel")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copyWithToast(url, t("creators.copyChannelUrl"))}
                  >
                    <Copy />
                    {t("common.copyUrl")}
                  </Button>
                </>
              )}
              <Button size="sm" disabled={analyzing} onClick={() => void analyze()}>
                {analyzing ? <Loader2 className="animate-spin" /> : <BarChart3 />}
                {creator.videosAnalyzed > 0
                  ? t("creatorDetail.reanalyze")
                  : t("creators.analyzeVideos")}
              </Button>
              <Select value={creator.status} onValueChange={(v) => void changeStatus(v as Creator["status"])}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATOR_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status.creator.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label={t("creators.colSubscribers")}
              value={
                creator.subscriberCountHidden
                  ? t("creators.hidden")
                  : dash(creator.subscriberCount)
              }
              hint={
                creator.subscriberCount !== null && !creator.subscriberCountHidden
                  ? fullNumber(creator.subscriberCount, locale)
                  : undefined
              }
            />
            <Metric label={t("creators.colAvgViews")} value={dash(creator.averageViews)} />
            <Metric label={t("creators.colMedianViews")} value={dash(creator.medianViews)} />
            <Metric
              label={t("creators.colRatio")}
              value={
                creator.viewToSubscriberRatio === null
                  ? "—"
                  : `${creator.viewToSubscriberRatio.toFixed(2)}×`
              }
              hint={t("creatorDetail.ratioHint")}
            />
            <Metric
              label={t("creatorDetail.channelTotalViews")}
              value={dash(creator.channelTotalViews)}
            />
            <Metric
              label={t("creatorDetail.channelVideoCount")}
              value={dash(creator.channelVideoCount, (n) => fullNumber(n, locale))}
            />
            <Metric
              label={t("creatorDetail.lastUpload")}
              value={creator.lastUploadAt ? relativeTime(creator.lastUploadAt, locale) : "—"}
              hint={creator.lastUploadAt ? formatDate(creator.lastUploadAt, locale) : undefined}
            />
            <Metric
              label={t("creatorDetail.uploadsRecent")}
              value={
                creator.uploadsLast30Days === null
                  ? "—"
                  : `${creator.uploadsLast30Days} / ${creator.uploadsLast90Days ?? 0}`
              }
              hint={t("creatorDetail.uploads3090")}
            />
          </div>

          {/* Score breakdown — why this number */}
          {creator.scoreBreakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{t("creatorDetail.scoreBreakdown")}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {t("creatorDetail.scoreBreakdownDesc")}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {creator.scoreBreakdown.map((c) => (
                  <div key={c.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span>{t(`scoreComponents.${c.key}`)}</span>
                      <span className="tabular text-muted-foreground">
                        {c.earned} / {c.max}
                      </span>
                    </div>
                    <Progress value={(c.earned / c.max) * 100} />
                    <p className="text-[11px] text-muted-foreground">
                      {t(c.detailKey, c.detailVars)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent content */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t("creatorDetail.recentContent")}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {videos.length > 0
                  ? t("creatorDetail.recentContentDesc", { count: videos.length })
                  : t("creatorDetail.recentContentEmptyDesc")}
              </p>
            </CardHeader>
            <CardContent className={videos.length > 0 ? "px-0 pb-0" : undefined}>
              {videos.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title={t("creatorDetail.noVideosTitle")}
                  description={t("creatorDetail.noVideosBody")}
                  action={
                    <Button size="sm" disabled={analyzing} onClick={() => void analyze()}>
                      <BarChart3 />
                      {t("creators.analyzeVideos")}
                    </Button>
                  }
                />
              ) : (
                <Table wrapperClassName="border-t border-border">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5">{t("creatorDetail.colVideo")}</TableHead>
                      <TableHead className="whitespace-nowrap">
                        {t("creatorDetail.colPublished")}
                      </TableHead>
                      <TableHead className="text-right">{t("creatorDetail.colViews")}</TableHead>
                      <TableHead className="text-right">{t("creatorDetail.colLikes")}</TableHead>
                      <TableHead className="text-right">{t("creatorDetail.colComments")}</TableHead>
                      <TableHead className="w-10 pr-5" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {videos.map((v) => (
                      <TableRow key={v.videoId}>
                        <TableCell className="max-w-[320px] pl-5">
                          <div className="flex items-center gap-2.5">
                            {v.thumbnailUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.thumbnailUrl}
                                alt=""
                                className="h-9 w-16 shrink-0 rounded object-cover"
                                loading="lazy"
                              />
                            )}
                            <span className="truncate text-[13px] font-medium">{v.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                          {formatDate(v.publishedAt, locale)}
                        </TableCell>
                        <TableCell className="text-right text-[13px] tabular">
                          {v.viewCount === null ? "—" : fullNumber(v.viewCount, locale)}
                          {creator.averageViews !== null &&
                            v.viewCount !== null &&
                            v.viewCount > creator.averageViews * 1.5 && (
                              <Badge variant="warning" className="ml-2">
                                {t("creatorDetail.spike")}
                              </Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-right text-[13px] tabular">
                          {v.likeCount === null ? "—" : fullNumber(v.likeCount, locale)}
                        </TableCell>
                        <TableCell className="text-right text-[13px] tabular">
                          {v.commentCount === null ? "—" : fullNumber(v.commentCount, locale)}
                        </TableCell>
                        <TableCell className="pr-5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("creatorDetail.openOnYoutube")}
                            onClick={() =>
                              window.open(
                                `https://youtube.com/watch?v=${v.videoId}`,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            <ExternalLink />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          {/* Contact — manual only in phase 1 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle>{t("creatorDetail.contactInformation")}</CardTitle>
              <EmailStatusBadge status={creator.emailStatus} />
            </CardHeader>
            <CardContent className="space-y-3">
              {editingEmail ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cd-email">{t("creatorDetail.fieldEmail")}</Label>
                    <Input
                      id="cd-email"
                      type="email"
                      autoFocus
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      placeholder="creator@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("creatorDetail.emailSource")}</Label>
                    <Select
                      value={emailSource}
                      onValueChange={(v) => setEmailSource(v as EmailSource)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMAIL_SOURCES.map((s) => (
                          <SelectItem key={s} value={s} disabled={s !== "manual"}>
                            {t(`emailSources.${s}`)}
                            {s !== "manual" && ` · ${t("platforms.comingSoon")}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingEmail(false);
                        setEmailDraft(creator.email ?? "");
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button size="sm" onClick={() => void saveEmail(emailDraft.trim() || null)}>
                      {t("common.save")}
                    </Button>
                  </div>
                </div>
              ) : creator.email ? (
                <>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a
                      href={`mailto:${creator.email}`}
                      className="min-w-0 flex-1 truncate text-[13px] underline-offset-4 hover:underline"
                    >
                      {creator.email}
                    </a>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("common.copy")}
                      onClick={() =>
                        void copyWithToast(creator.email!, t("creatorDetail.fieldEmail"))
                      }
                    >
                      <Copy />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("creatorDetail.emailSource")}: {t(`emailSources.${creator.emailSource}`)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditingEmail(true)}
                    >
                      <Pencil />
                      {t("creatorDetail.editEmail")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void saveEmail(null)}
                      aria-label={t("creatorDetail.removeEmail")}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-muted-foreground">
                    {t("creatorDetail.noEmailYet")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("creatorDetail.emailPhaseNote")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setEditingEmail(true)}
                  >
                    <Mail />
                    {t("creatorDetail.addEmailManually")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Channel facts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t("creatorDetail.creatorInformation")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border/70 text-[13px]">
                {[
                  [t("creatorDetail.channelId"), creator.youtubeChannelId ?? "—"],
                  [t("creatorDetail.country"), creator.country ?? "—"],
                  [
                    t("creatorDetail.channelCreated"),
                    creator.channelPublishedAt ? formatDate(creator.channelPublishedAt, locale) : "—",
                  ],
                  [t("creatorDetail.videosAnalyzed"), String(creator.videosAnalyzed)],
                  [
                    t("creatorDetail.lastSynced"),
                    creator.lastSyncedAt ? relativeTime(creator.lastSyncedAt, locale) : "—",
                  ],
                  [t("creatorDetail.addedOn"), formatDate(creator.createdAt, locale)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 py-2">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="max-w-[62%] truncate text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {/* Lists and campaigns this creator belongs to */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t("creatorDetail.memberships")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lists.length === 0 && campaigns.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  {t("creatorDetail.noMemberships")}
                </p>
              ) : (
                <div className="space-y-3">
                  {lists.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("nav.lists")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {lists.map((l) => (
                          <Link key={l.id} href={`/lists/${l.id}`}>
                            <Badge
                              variant="outline"
                              className="gap-1.5 transition-colors hover:bg-secondary"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: l.color }}
                              />
                              {l.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {campaigns.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("nav.campaigns")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {campaigns.map((c) => (
                          <Link key={c.id} href={`/campaigns/${c.id}`}>
                            <Badge
                              variant="outline"
                              className="gap-1.5 transition-colors hover:bg-secondary"
                            >
                              <Megaphone className="h-3 w-3" />
                              {c.name}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setListOpen(true)}
                >
                  <ListPlus />
                  {t("creators.addToList")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setCampaignOpen(true)}
                >
                  <Megaphone />
                  {t("creators.addToCampaign")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {creator.description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>{t("creatorDetail.channelDescription")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  {creator.description}
                </p>
              </CardContent>
            </Card>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 />
            {t("creators.removeFromDb")}
          </Button>
        </div>
      </div>

      <SendEmailDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        creator={creator}
        onSent={() => router.refresh()}
      />
      <AddToListDialog
        open={listOpen}
        onOpenChange={setListOpen}
        creatorIds={[creator.id]}
        onDone={() => router.refresh()}
      />
      <AddToCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        creatorIds={[creator.id]}
        onDone={() => router.refresh()}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("creators.removeTitle", { name: creator.name })}
        description={t("creators.removeBody")}
        confirmLabel={t("creators.removeFromDb")}
        destructive
        onConfirm={async () => {
          await fetch(`/api/creators/${creator.id}`, { method: "DELETE" });
          toast.success(t("creators.removed", { name: creator.name }));
          router.push("/creators");
        }}
      />
    </div>
  );
}
