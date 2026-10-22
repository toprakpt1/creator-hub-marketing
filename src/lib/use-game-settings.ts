"use client";

import * as React from "react";
import { DEFAULT_GAME, type GameIdentity } from "@/lib/outreach/render";

/**
 * The game name and link, as set on the Settings screen.
 *
 * Both the composer and the templates preview need the same values the server
 * will use. Keeping one module-level cache means opening ten dialogs costs one
 * request, and saving the settings updates it before the next render.
 */

let cached: GameIdentity = DEFAULT_GAME;
let inflight: Promise<GameIdentity> | null = null;

function normalize(value: unknown): GameIdentity {
  const game = value as { name?: unknown; link?: unknown } | null;
  const name = typeof game?.name === "string" ? game.name.trim() : "";
  const link = typeof game?.link === "string" ? game.link.trim() : "";
  return { name: name || DEFAULT_GAME.name, link };
}

export function loadGameSettings(): Promise<GameIdentity> {
  if (!inflight) {
    inflight = fetch("/api/settings/game")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { game?: unknown } | null) => {
        cached = normalize(body?.game);
        return cached;
      })
      .catch(() => cached)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Called after a successful save so later reads do not show the old values. */
export function rememberGameSettings(game: GameIdentity): void {
  cached = normalize(game);
}

export function useGameSettings(): GameIdentity {
  const [game, setGame] = React.useState<GameIdentity>(cached);

  React.useEffect(() => {
    let alive = true;
    void loadGameSettings().then((next) => {
      if (alive) setGame(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  return game;
}
