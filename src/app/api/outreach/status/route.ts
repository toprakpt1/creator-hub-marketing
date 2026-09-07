import { NextResponse } from "next/server";
import { dailyUsage, listMessages, outreachStats } from "@/lib/db/outreach";
import { mailerStatus, verifyConnection, MailerError } from "@/lib/outreach/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mail setup and send log, for the Outreach screen. Never returns the password. */
export async function GET() {
  return NextResponse.json({
    mailer: mailerStatus(),
    usage: dailyUsage(),
    stats: outreachStats(),
    messages: listMessages(50),
  });
}

/** Tests the SMTP credentials without sending anything. */
export async function POST() {
  try {
    await verifyConnection();
    return NextResponse.json({ ok: true, mailer: mailerStatus() });
  } catch (e) {
    const err = e instanceof MailerError ? e : new MailerError(String(e), "unknown");
    return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
  }
}
