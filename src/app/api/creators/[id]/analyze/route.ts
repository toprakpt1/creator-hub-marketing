import { NextResponse } from "next/server";
import { listVideos } from "@/lib/db/creators";
import { analyzeCreator } from "@/lib/youtube/discovery";
import { YouTubeApiError } from "@/lib/youtube/client";

/**
 * POST /api/creators/[id]/analyze — pulls this channel's recent uploads and
 * their statistics, then recomputes metrics, score and the rising signal.
 *
 * Costs 2 quota units per creator (playlistItems.list + videos.list), and only
 * ever runs when someone explicitly asks for it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let videoCount = 10;
  let runId: string | undefined;
  try {
    const body = (await request.json()) as { videoCount?: number; runId?: string };
    if (body?.videoCount) videoCount = Math.min(Math.max(Number(body.videoCount), 1), 50);
    if (typeof body?.runId === "string") runId = body.runId;
  } catch {
    /* body is optional */
  }

  try {
    const result = await analyzeCreator(id, videoCount, runId);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    return NextResponse.json({
      creator: result.creator,
      videos: listVideos(id),
      videosAnalyzed: result.videosAnalyzed,
    });
  } catch (error) {
    if (error instanceof YouTubeApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[creators/analyze] unexpected", error);
    return NextResponse.json({ error: "Analysis failed unexpectedly." }, { status: 500 });
  }
}
