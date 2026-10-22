import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { saveMailAccount } from "@/lib/db/mail";
import {
  exchangeCode,
  GmailError,
  oauthConfigured,
  resolveRedirectUri,
} from "@/lib/outreach/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "gmail_oauth_state";

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function back(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL("/settings", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

/** Google sends the browser back here with either a code or an error. */
export async function GET(request: NextRequest) {
  if (!oauthConfigured()) {
    return back(request, { gmail: "error", reason: "not_configured" });
  }

  const params = new URL(request.url).searchParams;
  const googleError = params.get("error");
  if (googleError) {
    return back(request, { gmail: "error", reason: googleError });
  }

  const code = params.get("code");
  const state = params.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !expected || !sameState(state, expected)) {
    return back(request, { gmail: "error", reason: "state_mismatch" });
  }

  let email: string;
  let tokens: Awaited<ReturnType<typeof exchangeCode>>["tokens"];
  try {
    const redirectUri = resolveRedirectUri(request.url);
    ({ email, tokens } = await exchangeCode(code, redirectUri));
  } catch (e) {
    const reason = e instanceof GmailError ? e.code : "exchange_failed";
    console.error("[gmail] token exchange failed:", e);
    return back(request, { gmail: "error", reason });
  }

  try {
    saveMailAccount({
      email,
      refreshToken: tokens.refresh_token as string,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope ?? null,
    });
  } catch (e) {
    console.error("[gmail] could not save the connected account:", e);
    return back(request, { gmail: "error", reason: "save_failed" });
  }

  return back(request, { gmail: "connected" });
}
