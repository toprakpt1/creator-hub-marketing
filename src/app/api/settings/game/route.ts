import { NextResponse } from "next/server";
import { getGameSettings, saveGameSettings } from "@/lib/db/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The game name and link every template fills in. */
export async function GET() {
  return NextResponse.json({ game: getGameSettings() });
}

/**
 * A store link goes straight into an email, so it is validated here rather than
 * trusted: a typo would otherwise reach a creator as a dead URL, which is one of
 * the strongest spam signals Gmail has.
 */
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, link } = (body ?? {}) as { name?: unknown; link?: unknown };

  if (typeof name !== "string") {
    return NextResponse.json({ error: "A game name is required.", code: "name_required" }, {
      status: 400,
    });
  }

  const gameName = name.trim();
  if (gameName.length === 0 || gameName.length > 80) {
    return NextResponse.json(
      { error: "The game name must be between 1 and 80 characters.", code: "name_invalid" },
      { status: 400 }
    );
  }

  if (link !== undefined && typeof link !== "string") {
    return NextResponse.json({ error: "The link must be text.", code: "link_invalid" }, {
      status: 400,
    });
  }

  const gameLink = (link ?? "").toString().trim();
  if (gameLink.length > 0) {
    let parsed: URL;
    try {
      parsed = new URL(gameLink);
    } catch {
      return NextResponse.json(
        { error: "The link must be a full address, starting with https://", code: "link_invalid" },
        { status: 400 }
      );
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "The link must start with http:// or https://", code: "link_invalid" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ game: saveGameSettings({ name: gameName, link: gameLink }) });
}
