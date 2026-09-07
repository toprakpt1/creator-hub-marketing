import { NextResponse } from "next/server";
import { getCreatorById, updateCreatorStatus } from "@/lib/db/creators";
import { getTemplate } from "@/lib/db/groups";
import {
  alreadyContacted,
  dailyUsage,
  markFailed,
  markSent,
  queueMessage,
} from "@/lib/db/outreach";
import { MailerError, readConfig, sendMail } from "@/lib/outreach/mailer";
import { bodyToHtml, renderTemplate, unresolvedVariables } from "@/lib/outreach/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends one outreach email.
 *
 * Deliberately one creator per request: a person approves each message in the
 * panel, the daily allowance is re-checked every time, and a failure affects
 * exactly one recipient instead of a whole batch.
 */
export async function POST(request: Request) {
  const config = readConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "Email sending is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASS to .env.local.",
        code: "not_configured",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    creatorId,
    templateId,
    subject: subjectOverride,
    body: bodyOverride,
    campaignId,
    allowResend,
  } = (body ?? {}) as {
    creatorId?: string;
    templateId?: string;
    subject?: string;
    body?: string;
    campaignId?: string;
    allowResend?: boolean;
  };

  if (!creatorId) {
    return NextResponse.json({ error: "No creator selected." }, { status: 400 });
  }

  const creator = getCreatorById(creatorId);
  if (!creator) {
    return NextResponse.json({ error: "Creator not found." }, { status: 404 });
  }
  if (!creator.email) {
    return NextResponse.json(
      { error: `${creator.name} has no email address saved.`, code: "no_email" },
      { status: 400 }
    );
  }

  // Mailing the same creator twice by accident is the easy mistake to make.
  if (!allowResend && alreadyContacted(creatorId)) {
    return NextResponse.json(
      { error: `${creator.name} has already been contacted.`, code: "already_contacted" },
      { status: 409 }
    );
  }

  const usage = dailyUsage();
  if (usage.remaining <= 0) {
    return NextResponse.json(
      {
        error: `Today's sending limit (${usage.limit}) is used up. It resets tomorrow.`,
        code: "daily_limit",
      },
      { status: 429 }
    );
  }

  // Either an edited draft from the panel, or straight from a template.
  let rawSubject = subjectOverride;
  let rawBody = bodyOverride;

  if (rawSubject == null || rawBody == null) {
    if (!templateId) {
      return NextResponse.json({ error: "No template selected." }, { status: 400 });
    }
    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    rawSubject = rawSubject ?? template.subject;
    rawBody = rawBody ?? template.body;
  }

  const subject = renderTemplate(rawSubject, creator).trim();
  const text = renderTemplate(rawBody, creator).trim();

  if (!subject) {
    return NextResponse.json({ error: "The subject is empty." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "The message body is empty." }, { status: 400 });
  }

  // A literal {{token}} reaching a creator's inbox looks careless, so refuse.
  const leftover = [
    ...unresolvedVariables(rawSubject, creator),
    ...unresolvedVariables(rawBody, creator),
  ];
  if (leftover.length > 0) {
    return NextResponse.json(
      {
        error: `These variables have no value and would be sent as-is: ${[...new Set(leftover)].join(", ")}`,
        code: "unresolved_variables",
      },
      { status: 400 }
    );
  }

  const messageId = queueMessage({
    creatorId,
    templateId: templateId ?? null,
    campaignId: campaignId ?? null,
    toEmail: creator.email,
    fromEmail: config.fromEmail,
    subject,
    body: text,
  });

  try {
    const result = await sendMail({
      to: creator.email,
      subject,
      text,
      html: bodyToHtml(text),
    });

    markSent(messageId, result.messageId || null);

    // Only move the pipeline forward — never drag a further-along creator back.
    if (creator.status === "new" || creator.status === "reviewing" ||
        creator.status === "qualified" || creator.status === "shortlisted" ||
        creator.status === "ready_to_contact") {
      updateCreatorStatus(creatorId, "contacted");
    }

    return NextResponse.json({
      ok: true,
      messageId,
      previewUrl: result.previewUrl,
      usage: dailyUsage(),
    });
  } catch (e) {
    const err = e instanceof MailerError ? e : new MailerError(String(e), "unknown");
    markFailed(messageId, err.message);
    return NextResponse.json(
      { error: err.message, code: err.code, messageId },
      { status: err.code === "auth_failed" ? 502 : 500 }
    );
  }
}
