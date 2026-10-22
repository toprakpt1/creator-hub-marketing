"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useT } from "@/lib/i18n/provider";
import type { GameIdentity } from "@/lib/outreach/render";
import { rememberGameSettings } from "@/lib/use-game-settings";

/**
 * The game every template talks about.
 *
 * `{{game_name}}` and `{{game_link}}` / `{{steam_link}}` read from here, and the
 * composer refuses to send while the link is empty — a store URL that goes
 * nowhere is one of the clearest spam signals there is.
 */
export function GameCard({ initial }: { initial: GameIdentity }) {
  const t = useT();
  const router = useRouter();

  const [name, setName] = React.useState(initial.name);
  const [link, setLink] = React.useState(initial.link);
  const [saving, setSaving] = React.useState(false);

  const dirty = name.trim() !== initial.name || link.trim() !== initial.link;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/game", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, link }),
      });
      const data = (await res.json()) as { game?: GameIdentity; error?: string };
      if (!res.ok || !data.game) throw new Error(data.error ?? t("settings.gameSaveFailed"));

      rememberGameSettings(data.game);
      setName(data.game.name);
      setLink(data.game.link);
      toast.success(t("settings.gameSaved"));
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{t("settings.gameCardTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("settings.gameCardDesc")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="game-name">{t("settings.gameName")}</Label>
          <Input
            id="game-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Taco"
            maxLength={80}
          />
          <p className="text-[11px] text-muted-foreground">{t("settings.gameNameHint")}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="game-link">{t("settings.gameLink")}</Label>
          <Input
            id="game-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://yourgame.itch.io/your-game"
            inputMode="url"
            maxLength={500}
          />
          <p className="text-[11px] text-muted-foreground">{t("settings.gameLinkHint")}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" disabled={!dirty || saving || name.trim().length === 0} onClick={() => void save()}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {t("common.save")}
          </Button>
          {!dirty && <span className="text-xs text-muted-foreground">{t("settings.gameSavedHint")}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
