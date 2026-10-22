import { NextResponse } from "next/server";
import {
  clearMailAccount,
  getMailAccountSummary,
  markMailAccountVerified,
} from "@/lib/db/mail";
import {
  GmailError,
  oauthConfigured,
  revokeGmail,
  verifyGmail,
} from "@/lib/outreach/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Connected account summary for the settings panel. Never returns tokens. */
export async function GET() {
  return NextResponse.json({
    account: getMailAccountSummary(),
    oauthConfigured: oauthConfigured(),
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

/** Disconnects locally and revokes the grant at Google. */
export async function DELETE() {
  await revokeGmail();
  clearMailAccount();
  return NextResponse.json({ ok: true });
}
