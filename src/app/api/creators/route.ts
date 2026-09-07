import { NextResponse } from "next/server";
import { listCreators, saveCandidates } from "@/lib/db/creators";
import { recordAddedCreators } from "@/lib/db/runs";
import type { DiscoveryCandidate } from "@/lib/types";

/**
 * GET  /api/creators — every saved creator.
 * POST /api/creators — saves selected discovery candidates.
 *
 * Saving is deliberately separate from searching: a search result only becomes
 * a creator when someone chooses it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ creators: listCreators() });
  } catch (error) {
    console.error("[creators] list failed", error);
    return NextResponse.json({ error: "Could not read creators." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { candidates, runId } = (body ?? {}) as {
    candidates?: DiscoveryCandidate[];
    runId?: string;
  };

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ error: "No creators selected." }, { status: 400 });
  }

  const valid = candidates.filter(
    (c) => typeof c?.youtubeChannelId === "string" && typeof c?.name === "string"
  );
  if (valid.length === 0) {
    return NextResponse.json({ error: "Selected creators were malformed." }, { status: 400 });
  }

  try {
    const result = saveCandidates(valid);
    if (runId && result.added > 0) recordAddedCreators(runId, result.added);
    return NextResponse.json({
      added: result.added,
      skipped: result.skipped,
      ids: result.ids,
    });
  } catch (error) {
    console.error("[creators] save failed", error);
    return NextResponse.json({ error: "Could not save creators." }, { status: 500 });
  }
}
