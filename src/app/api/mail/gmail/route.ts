import { NextResponse } from "next/server";
import {
  clearMailAccount,
  getMailAccountSummary,
  markMailAccountVerified,
  updateMailFromName,
} from "@/lib/db/mail";
import {
  GmailError,
  oauthConfigured,
  resolveRedirectUri,
  revokeGmail,
  verifyGmail,
} from "@/lib/outreach/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Connected account summary for the settings panel. Never returns tokens.
 * `redirectUri` is the exact value Google must have registered — it changes
 * with the port and host the app is opened on.
 */
export async function GET(request: Request) {
  return NextResponse.json({
    account: getMailAccountSummary(),
    oauthConfigured: oauthConfigured(),
    redirectUri: resolveRedirectUri(request.url),
  });
}

/** Refreshes the token, which proves the Google grant is still valid. */
export async function POST() {
  try {
    await verifyGmail();
    markMailAccountVerified();
    return NextResponse.json({ ok: true, account: getMailAccountSummary() });
  } catch (e) {
    const err = e instanceof GmailError ? e : new GmailError(String(e), "send_failed");
    return NextResponse.json(
      { error: err.message, code: err.code, account: getMailAccountSummary() },
      { status: 400 }
    );
  }
}

/** Updates the sender display name shown in the recipient's inbox. */
export async function PATCH(request: Request) {
  const account = getMailAccountSummary();
  if (!account) {
    return NextResponse.json({ error: "No Gmail account is connected." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { fromName?: unknown };
  if (body.fromName !== undefined && typeof body.fromName !== "string") {
    return NextResponse.json({ error: "Invalid sender name." }, { status: 400 });
  }

  const name =
    typeof body.fromName === "string"
      ? body.fromName.replace(/[\r\n\t]+/g, " ").trim()
      : "";

  if (name.length > 80) {
    return NextResponse.json(
      { error: "The sender name must be 80 characters or fewer." },
      { status: 400 }
    );
  }

  updateMailFromName(name || null);
  return NextResponse.json({ account: getMailAccountSummary() });
}

/** Disconnects locally and revokes the grant at Google. */
export async function DELETE() {
  await revokeGmail();
  clearMailAccount();
  return NextResponse.json({ ok: true });
}
