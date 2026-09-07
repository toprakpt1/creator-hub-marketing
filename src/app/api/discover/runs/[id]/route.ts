import { NextResponse } from "next/server";
import { getRun } from "@/lib/db/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/discover/runs/[id] — replays a past run's cached candidates, free. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const found = getRun(id);
  if (!found) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  return NextResponse.json({ ...found, fromCache: true });
}
