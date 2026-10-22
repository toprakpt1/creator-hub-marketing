import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthUrl, oauthConfigured, resolveRedirectUri } from "@/lib/outreach/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "gmail_oauth_state";

/**
 * Starts the Google consent flow.
 *
 * Nothing is written to the database yet — the account only becomes connected
 * once the callback proves it holds the same `state` we set here.
 */
export async function GET(request: Request) {
  if (!oauthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google OAuth is not configured. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to .env.",
        code: "not_configured",
      },
      { status: 503 }
    );
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const redirectUri = resolveRedirectUri(request.url);
  const secure = new URL(request.url).protocol === "https:";

  console.log(`[gmail] authorize redirect_uri: ${redirectUri}`);

  const response = NextResponse.redirect(buildAuthUrl(state, redirectUri));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  return response;
}
