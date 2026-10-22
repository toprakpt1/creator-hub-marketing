import "server-only";
import MimeNode from "nodemailer/lib/mime-node";

/**
 * Builds the RFC 822 message for both transports.
 *
 * Gmail expects a different tree than Nodemailer's default:
 *
 *   multipart/related
 *     multipart/alternative
 *       text/plain
 *       text/html
 *     image/png (cid)
 *     image/png (cid)
 *
 * Nodemailer puts the related wrapper *inside* the alternative, which Gmail
 * does not treat as the preferred HTML alternative — it falls back to the
 * text/plain part, and the recipient sees image filenames instead of pictures.
 * Building the tree with MimeNode directly keeps header folding, transfer
 * encodings and boundaries correct while giving Gmail the shape it expects.
 */
/** An image that travels inside the message instead of behind a public URL. */
export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** When set, the HTML part reaches it as `cid:<cid>`. */
  cid?: string;
}

export interface RawMessageInput {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: MailAttachment[];
}

function addTextParts(parent: MimeNode, input: RawMessageInput): void {
  const text = parent.createChild("text/plain; charset=utf-8");
  text.setContent(input.text);

  const html = parent.createChild("text/html; charset=utf-8");
  html.setContent(input.html);
}

function addAlternative(parent: MimeNode, input: RawMessageInput): void {
  addTextParts(parent.createChild("multipart/alternative"), input);
}

function addAttachment(parent: MimeNode, attachment: MailAttachment): void {
  const node = parent.createChild(attachment.contentType, { filename: attachment.filename });
  if (attachment.cid) {
    // Gmail's own messages carry both; X-Attachment-Id is what its web client
    // uses to pair an inline image with the cid: reference in the HTML.
    node.setHeader("Content-ID", `<${attachment.cid}>`);
    node.setHeader("X-Attachment-Id", attachment.cid);
    node.setHeader("Content-Disposition", "inline");
  } else {
    node.setHeader("Content-Disposition", "attachment");
  }
  node.setContent(attachment.content);
}

export async function buildMessageBuffer(input: RawMessageInput): Promise<Buffer> {
  const attachments = input.attachments ?? [];
  const inline = attachments.filter((attachment) => !!attachment.cid);
  const regular = attachments.filter((attachment) => !attachment.cid);

  const root = new MimeNode(
    regular.length > 0
      ? "multipart/mixed"
      : inline.length > 0
        ? 'multipart/related; type="multipart/alternative"'
        : "multipart/alternative"
  );

  root.setHeader("From", { name: input.fromName, address: input.fromEmail });
  root.setHeader("To", input.to);
  root.setHeader("Reply-To", input.replyTo || input.fromEmail);
  root.setHeader("Subject", input.subject);
  // Gmail counts a working opt-out as a positive sender signal, and a mail
  // with no way out is the first thing a recipient reports. The mailto form
  // needs no web endpoint; `List-Unsubscribe-Post` is only valid alongside
  // an HTTPS one-click URL, so it is deliberately absent.
  root.setHeader("List-Unsubscribe", `<mailto:${input.fromEmail}?subject=unsubscribe>`);

  if (regular.length > 0) {
    if (inline.length > 0) {
      const related = root.createChild('multipart/related; type="multipart/alternative"');
      addAlternative(related, input);
      for (const attachment of inline) addAttachment(related, attachment);
    } else {
      addAlternative(root, input);
    }
    for (const attachment of regular) addAttachment(root, attachment);
  } else if (inline.length > 0) {
    addAlternative(root, input);
    for (const attachment of inline) addAttachment(root, attachment);
  } else {
    addTextParts(root, input);
  }

  return root.build();
}

/** Same message, encoded the way the Gmail API wants it in `raw`. */
export async function buildRawMessage(input: RawMessageInput): Promise<string> {
  return (await buildMessageBuffer(input)).toString("base64url");
}
