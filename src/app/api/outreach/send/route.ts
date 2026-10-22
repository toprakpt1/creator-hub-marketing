import { NextResponse } from "next/server";
import { getCreatorById, updateCreatorStatus } from "@/lib/db/creators";
import { getTemplate } from "@/lib/db/groups";
import {
  alreadyContacted,
  dailyUsage,
  DUPLICATE_CONTENT_THRESHOLD,
  lastSentAt,
  markFailed,
  markSent,
  queueMessage,
  recentDuplicates,
  SEND_INTERVAL_MS,
} from "@/lib/db/outreach";
import { readAssetFile } from "@/lib/outreach/assets";
import { MailerError, mailerStatus, sendMail } from "@/lib/outreach/mailer";
import { getGameSettings } from "@/lib/db/settings";
import type { MailAttachment } from "@/lib/outreach/mime";
import { assetCid, MAX_TOTAL_IMAGE_BYTES } from "@/lib/outreach/markup";
import {
  extractAssetIds,
  renderBodyHtml,
  renderBodyPlainText,
  renderTemplate,
  unresolvedVariables,
} from "@/lib/outreach/render";

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
  const mail = mailerStatus();
  if (!mail.configured) {
    return NextResponse.json(
      {
        error: mail.needsReconnect
          ? mail.lastError ?? "The Gmail connection needs to be renewed in Settings."
          : "Email sending is not configured. Connect Gmail in Settings or add SMTP settings to .env.",
        code: mail.needsReconnect ? "needs_reconnect" : "not_configured",
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
    allowDuplicate,
  } = (body ?? {}) as {
    creatorId?: string;
    templateId?: string;
    subject?: string;
    body?: string;
    campaignId?: string;
    allowResend?: boolean;
    allowDuplicate?: boolean;
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

  // Spacing, not volume. Two copies 55 seconds apart is what a bulk sender
  // looks like; a person writing to one creator does not type that fast.
  const lastSend = lastSentAt();
  if (lastSend) {
    const waited = Date.now() - Date.parse(lastSend);
    if (waited < SEND_INTERVAL_MS) {
      const retryAfter = Math.ceil((SEND_INTERVAL_MS - waited) / 1000);
      return NextResponse.json(
        {
          error: `The previous email went out ${Math.max(
            1,
            Math.round(waited / 1000)
          )}s ago. Wait ${retryAfter}s so the sends do not look automated.`,
          code: "too_soon",
          retryAfter,
        },
        { status: 429 }
      );
    }
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

  const game = getGameSettings();
  const subject = renderTemplate(rawSubject, creator, game).trim();
  const renderedBody = renderTemplate(rawBody, creator, game).trim();

  if (!subject) {
    return NextResponse.json({ error: "The subject is empty." }, { status: 400 });
  }
  if (!renderedBody) {
    return NextResponse.json({ error: "The message body is empty." }, { status: 400 });
  }

  // A literal {{token}} reaching a creator's inbox looks careless, so refuse.
  const leftover = [
    ...unresolvedVariables(rawSubject, creator, game),
    ...unresolvedVariables(rawBody, creator, game),
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

  const html = renderBodyHtml(renderedBody, { assetSrc: (id) => `cid:${assetCid(id)}` });
  const text = renderBodyPlainText(renderedBody);

  // Content is what Gmail clusters on. Reusing one body for everyone is how a
  // perfectly legitimate mail starts arriving next to "similar to previously
  // identified spam" — so call it out before the third copy goes out.
  if (!allowDuplicate) {
    const duplicates = recentDuplicates(subject, text);
    if (duplicates >= DUPLICATE_CONTENT_THRESHOLD) {
      return NextResponse.json(
        {
          error: `This exact subject and body already went to ${duplicates} ${
            duplicates === 1 ? "creator" : "creators"
          } in the last day. Change the wording before sending, or confirm to send it again.`,
          code: "duplicate_content",
          duplicates,
        },
        { status: 409 }
      );
    }
  }

  // Images uploaded to the panel travel as CID parts. Load them before the
  // message is queued so a missing file cannot look like a successful send.
  const attachments: MailAttachment[] = [];
  let attachmentBytes = 0;
  for (const assetId of extractAssetIds(renderedBody)) {
    const found = await readAssetFile(assetId);
    if (!found) {
      return NextResponse.json(
        {
          error: "This template references an image that no longer exists. Add it again and save.",
          code: "missing_image",
        },
        { status: 409 }
      );
    }
    attachmentBytes += found.buffer.length;
    if (attachmentBytes > MAX_TOTAL_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: `The images in this message exceed ${Math.round(
            MAX_TOTAL_IMAGE_BYTES / (1024 * 1024)
          )} MB. Remove one and try again.`,
          code: "attachments_too_large",
        },
        { status: 413 }
      );
    }
    attachments.push({
      filename: found.asset.filename,
      content: found.buffer,
      contentType: found.asset.mime,
      cid: assetCid(assetId),
    });
  }

  const messageId = queueMessage({
    creatorId,
    templateId: templateId ?? null,
    campaignId: campaignId ?? null,
    toEmail: creator.email,
    fromEmail: mail.fromEmail ?? "",
    subject,
    body: text,
  });

  try {
    const result = await sendMail({
      to: creator.email,
      subject,
      text,
      html,
      attachments,
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
