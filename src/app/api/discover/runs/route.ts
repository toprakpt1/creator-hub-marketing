import { NextResponse } from "next/server";
import { listRuns } from "@/lib/db/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/discover/runs — discovery history, newest first. */
export async function GET() {
  try {
    return NextResponse.json({ runs: listRuns(100) });
  } catch (error) {
    console.error("[discover/runs] failed", error);
    return NextResponse.json({ error: "Could not read discovery history." }, { status: 500 });
  }
}
