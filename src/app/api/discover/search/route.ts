import { NextResponse } from "next/server";
import {
  CachedRunError,
  QuotaGuardError,
  runDiscovery,
} from "@/lib/youtube/discovery";
import { YouTubeApiError } from "@/lib/youtube/client";
import type { DiscoveryQuery } from "@/lib/types";

/**
 * POST /api/discover/search — runs one YouTube search.
 *
 * The API key lives only in this process; the browser never sees it and never
 * talks to googleapis.com directly.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS_ALLOWED = [10, 25, 50];

function parseQuery(body: unknown): DiscoveryQuery | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;

  const keyword = typeof b.keyword === "string" ? b.keyword.trim() : "";
  if (!keyword) return { error: "Enter a keyword to search for." };
  if (keyword.length > 100) return { error: "Keyword is too long." };

  const maxResults = Number(b.maxResults ?? 25);
  if (!MAX_RESULTS_ALLOWED.includes(maxResults)) {
    return { error: "Results per search must be 10, 25 or 50." };
  }

  const minSubscribers = Math.max(0, Number(b.minSubscribers ?? 10));
  const maxSubscribers = Math.max(minSubscribers, Number(b.maxSubscribers ?? 50000));

  return {
    keyword,
    maxResults,
    region: typeof b.region === "string" && b.region ? b.region : undefined,
    language: typeof b.language === "string" && b.language ? b.language : undefined,
    publishedWithinDays: b.publishedWithinDays ? Number(b.publishedWithinDays) : undefined,
    minSubscribers,
    maxSubscribers,
    pageToken: typeof b.pageToken === "string" && b.pageToken ? b.pageToken : undefined,
    force: b.force === true,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = parseQuery(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const outcome = await runDiscovery(parsed);
    return NextResponse.json(outcome);
  } catch (error) {
    if (error instanceof CachedRunError) {
      // Not a failure: an identical search ran recently. Hand back the cached
      // results and let the user decide whether to spend quota again.
      return NextResponse.json(
        {
          cached: true,
          message: "An identical search ran in the last 24 hours. No quota was spent.",
          ...error.outcome,
        },
        { status: 200 }
      );
    }
    if (error instanceof QuotaGuardError) {
      return NextResponse.json(
        { error: error.message, code: "quota_guard" },
        { status: 429 }
      );
    }
    if (error instanceof YouTubeApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[discover/search] unexpected", error);
    return NextResponse.json({ error: "Discovery failed unexpectedly." }, { status: 500 });
  }
}
