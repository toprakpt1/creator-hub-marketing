import { NextResponse } from "next/server";
import { getQuotaUsage } from "@/lib/db/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/quota — today's YouTube API usage, for the in-app meter. */
export async function GET() {
  try {
    return NextResponse.json(getQuotaUsage());
  } catch (error) {
    console.error("[quota] failed", error);
    return NextResponse.json({ error: "Could not read quota usage." }, { status: 500 });
  }
}
