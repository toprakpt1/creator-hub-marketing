import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP transport.
 *
 * This is the only place SMTP credentials are read. They are plain server
 * environment variables — never `NEXT_PUBLIC_*` — so they cannot reach the
 * browser, exactly like the YouTube API key.
 *
 * Any SMTP server works: Gmail with an app password to start, a provider like
 * Brevo later, or Ethereal while developing. Switching is a config change.
 */

export class MailerError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "auth_failed"
      | "connection_failed"
      | "rejected"
      | "unknown"
  ) {
    super(message);
    this.name = "MailerError";
  }
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
    fromName: process.env.SMTP_FROM_NAME?.trim() || "Chest Blade",
    // Most providers reject a From that is not the authenticated mailbox.
    fromEmail: process.env.SMTP_FROM_EMAIL?.trim() || user,
  };
}

/** What the panel may show about the mail setup. Never includes the password. */
export function mailerStatus() {
  const config = readConfig();
  if (!config) return { configured: false as const };
  return {
    configured: true as const,
    host: config.host,
    port: config.port,
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
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

/** Network hiccups worth one more attempt; auth and rejection are not. */
const TRANSIENT = new Set(["ESOCKET", "ETIMEDOUT", "ECONNECTION", "ECONNRESET"]);

function translate(error: unknown): MailerError {
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
  const config = readConfig();
  if (!config) {
    throw new MailerError("No SMTP settings found. Add them to .env.local.", "not_configured");
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
}): Promise<SendResult> {
  const config = readConfig();
  if (!config) {
    throw new MailerError("No SMTP settings found. Add them to .env.local.", "not_configured");
  }

  const message = {
    from: { name: config.fromName, address: config.fromEmail },
    to: input.to,
    replyTo: input.replyTo || config.fromEmail,
    subject: input.subject,
    text: input.text,
    html: input.html,
  };

  let lastError: unknown;

  // One retry, and only for a dropped connection — never for a rejection,
  // which would mean sending the same creator a second copy.
  for (let attempt = 0; attempt < 2; attempt++) {
    const transporter = transporterFor(config);
    try {
      const info = await transporter.sendMail(message);
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
