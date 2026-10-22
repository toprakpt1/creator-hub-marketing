import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import {
  getMailAccount,
  getMailAccountSummary,
  markMailAccountVerified,
} from "@/lib/db/mail";
import {
  GmailError,
  sendViaGmail,
  verifyGmail,
} from "@/lib/outreach/gmail";
import { buildMessageBuffer, type MailAttachment } from "@/lib/outreach/mime";

/**
 * The mail provider layer.
 *
 * A connected Gmail account (OAuth2) is preferred; a plain SMTP server from
 * the environment is the fallback. Both paths expose the same four functions,
 * so the rest of the app does not care which one is live.
 *
 * SMTP credentials are plain server environment variables — never
 * `NEXT_PUBLIC_*` — so they cannot reach the browser, exactly like the
 * YouTube API key.
 */

export class MailerError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "needs_reconnect"
      | "auth_failed"
      | "connection_failed"
      | "rejected"
      | "rate_limited"
      | "unknown"
  ) {
    super(message);
    this.name = "MailerError";
  }
}

/**
 * The name in the recipient's inbox. Settings wins, then the environment, then
 * a neutral fallback derived from the connected mailbox — never a hard-coded
 * game name, which used to leak into every customer's email client.
 */
export function defaultFromName(): string {
  const account = getMailAccountSummary();
  const stored = account?.fromName?.trim();
  if (stored) return stored;

  const env = process.env.SMTP_FROM_NAME?.trim();
  if (env) return env;

  if (account?.email) return account.email.split("@")[0];
  return "Creator Hub";
}

export interface MailerConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export function readConfig(): MailerConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    user,
    pass,
    fromName: process.env.SMTP_FROM_NAME?.trim() || "Creator Hub",
    // Most providers reject a From that is not the authenticated mailbox.
    fromEmail: process.env.SMTP_FROM_EMAIL?.trim() || user,
  };
}

/** What the panel may show about the mail setup. Never includes the password. */
export interface MailerStatus {
  configured: boolean;
  provider: "gmail" | "smtp" | null;
  host: string | null;
  fromName: string;
  fromEmail: string | null;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  needsReconnect?: boolean;
  lastError?: string | null;
}

export function mailerStatus(): MailerStatus {
  const account = getMailAccount();
  if (account) {
    return {
      configured: !account.needsReconnect,
      provider: "gmail",
      host: "gmail.googleapis.com",
      fromName: defaultFromName(),
      fromEmail: account.email,
      connectedAt: account.connectedAt,
      lastVerifiedAt: account.lastVerifiedAt,
      needsReconnect: account.needsReconnect,
      lastError: account.lastError,
    };
  }

  const config = readConfig();
  if (!config) {
    return {
      configured: false,
      provider: null,
      host: null,
      fromName: defaultFromName(),
      fromEmail: null,
    };
  }

  return {
    configured: true,
    provider: "smtp",
    host: config.host,
    fromName: config.fromName,
    fromEmail: config.fromEmail,
  };
}

/**
 * Built fresh each time on purpose. Without pooling a transporter holds no
 * connection worth reusing, and a cached one whose socket has gone idle fails
 * the next send with ESOCKET — which cost a real message in testing.
 */
function transporterFor(config: MailerConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    // Nodemailer introduces itself with the machine's hostname, and a Linux
    // laptop usually has no FQDN — so it falls back to `[127.0.0.1]` in EHLO
    // and in the Message-ID. A sending domain costs nothing and looks normal.
    name: config.fromEmail.split("@")[1] || undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

/** Network hiccups worth one more attempt; auth and rejection are not. */
const TRANSIENT = new Set(["ESOCKET", "ETIMEDOUT", "ECONNECTION", "ECONNRESET"]);

function translate(error: unknown): MailerError {
  if (error instanceof GmailError) {
    const code =
      error.code === "needs_reconnect"
        ? "needs_reconnect"
        : error.code === "not_configured"
          ? "not_configured"
          : error.code === "forbidden"
            ? "rejected"
            : error.code === "rate_limited"
              ? "rate_limited"
              : "unknown";
    return new MailerError(error.message, code);
  }

  const e = error as { code?: string; responseCode?: number; message?: string };
  const code = e?.code ?? "";
  const message = e?.message ?? "Sending failed.";

  if (code === "EAUTH" || e?.responseCode === 535) {
    return new MailerError(
      "The mail server rejected the username or password. For Gmail this must be a 16-character app password, not the account password.",
      "auth_failed"
    );
  }
  if (code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ESOCKET" || code === "EDNS") {
    return new MailerError(
      `Could not reach the mail server (${code}). Check SMTP_HOST and SMTP_PORT.`,
      "connection_failed"
    );
  }
  if (code === "EENVELOPE" || (e?.responseCode && e.responseCode >= 500)) {
    return new MailerError(`The mail server rejected the message: ${message}`, "rejected");
  }
  return new MailerError(message, "unknown");
}

/** Confirms the credentials without sending anything. */
export async function verifyConnection(): Promise<void> {
  if (getMailAccount()) {
    try {
      await verifyGmail();
      markMailAccountVerified();
      return;
    } catch (e) {
      throw translate(e);
    }
  }

  const config = readConfig();
  if (!config) {
    throw new MailerError("No mail account is connected. Connect Gmail in Settings.", "not_configured");
  }
  const transporter = transporterFor(config);
  try {
    await transporter.verify();
  } catch (e) {
    throw translate(e);
  } finally {
    transporter.close();
  }
}

export interface SendResult {
  messageId: string;
  /** Ethereal hands back a preview URL; real providers do not. */
  previewUrl: string | null;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}): Promise<SendResult> {
  const account = getMailAccount();
  if (account) {
    try {
      const result = await sendViaGmail({
        fromName: defaultFromName(),
        fromEmail: account.email,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
        attachments: input.attachments,
      });
      return { messageId: result.messageId, previewUrl: null };
    } catch (e) {
      throw translate(e);
    }
  }

  const config = readConfig();
  if (!config) {
    throw new MailerError("No mail account is connected. Connect Gmail in Settings.", "not_configured");
  }

  // Build the same Gmail-friendly tree as the API path. Nodemailer's default
  // alternative > related nesting makes Gmail show the plain-text version.
  const raw = await buildMessageBuffer({
    fromName: config.fromName,
    fromEmail: config.fromEmail,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
    attachments: input.attachments,
  });
  const envelope = { from: config.fromEmail, to: [input.to] };

  let lastError: unknown;

  // One retry, and only for a dropped connection — never for a rejection,
  // which would mean sending the same creator a second copy.
  for (let attempt = 0; attempt < 2; attempt++) {
    const transporter = transporterFor(config);
    try {
      const info = await transporter.sendMail({ envelope, raw });
      const preview = nodemailer.getTestMessageUrl(info);
      return { messageId: info.messageId ?? "", previewUrl: preview === false ? null : preview };
    } catch (e) {
      lastError = e;
      const code = (e as { code?: string })?.code ?? "";
      if (!TRANSIENT.has(code)) break;
    } finally {
      transporter.close();
    }
  }

  throw translate(lastError);
}
