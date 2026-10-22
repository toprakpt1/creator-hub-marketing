import "server-only";
import nodemailer from "nodemailer";

/**
 * Builds the RFC 822 message that the Gmail API wants in `raw`.
 *
 * Nodemailer already knows how to fold headers, pick encodings and build a
 * multipart/alternative body, so we use its stream transport instead of
 * hand-rolling MIME. Nothing is sent here — the buffer is handed back.
 */
export async function buildRawMessage(input: {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}): Promise<string> {
  const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });

  const info = await transporter.sendMail({
    from: { name: input.fromName, address: input.fromEmail },
    to: input.to,
    replyTo: input.replyTo || input.fromEmail,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  const message = info.message as unknown;
  if (!Buffer.isBuffer(message)) {
    throw new Error("Nodemailer did not return a buffered message.");
  }

  // Gmail expects base64url, not standard base64.
  return message.toString("base64url");
}
