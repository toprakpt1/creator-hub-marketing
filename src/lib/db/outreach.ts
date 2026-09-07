import { randomUUID } from "node:crypto";
import { getDb, nowIso, todayKey } from "@/lib/db/client";
import type { OutreachMessage } from "@/lib/types";

/**
 * The outreach log.
 *
 * A row is written before the SMTP call and updated with the outcome, so a
 * crash mid-send still leaves a trace instead of silently losing a message.
 * Nothing here decides *what* to send — that is the caller's job.
 */

/** Gmail allows roughly this many recipients a day on a free account. */
export const DEFAULT_DAILY_LIMIT = Number(process.env.SMTP_DAILY_LIMIT ?? 500);

interface Row {
  id: string;
  creator_id: string;
  template_id: string | null;
  campaign_id: string | null;
  to_email: string;
  from_email: string;
  subject: string;
  body: string;
  status: string;
  provider_id: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  creator_name?: string;
}

function map(row: Row): OutreachMessage {
  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorName: row.creator_name ?? null,
    templateId: row.template_id,
    campaignId: row.campaign_id,
    toEmail: row.to_email,
    fromEmail: row.from_email,
    subject: row.subject,
    body: row.body,
    status: row.status as OutreachMessage["status"],
    providerId: row.provider_id,
    error: row.error,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

export function queueMessage(input: {
  creatorId: string;
  templateId: string | null;
  campaignId?: string | null;
  toEmail: string;
  fromEmail: string;
  subject: string;
  body: string;
}): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO outreach_messages
         (id, creator_id, template_id, campaign_id, to_email, from_email,
          subject, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`
    )
    .run(
      id,
      input.creatorId,
      input.templateId,
      input.campaignId ?? null,
      input.toEmail,
      input.fromEmail,
      input.subject,
      input.body,
      nowIso()
    );
  return id;
}

export function markSent(id: string, providerId: string | null): void {
  getDb()
    .prepare(
      `UPDATE outreach_messages SET status = 'sent', provider_id = ?, sent_at = ?, error = NULL
       WHERE id = ?`
    )
    .run(providerId, nowIso(), id);
}

export function markFailed(id: string, error: string): void {
  getDb()
    .prepare(`UPDATE outreach_messages SET status = 'failed', error = ? WHERE id = ?`)
    .run(error.slice(0, 500), id);
}

/** Sends counted against today's allowance. Failures do not count. */
export function sentToday(): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM outreach_messages
        WHERE status = 'sent' AND substr(sent_at, 1, 10) = ?`
    )
    .get(todayKey()) as { c: number };
  return row.c;
}

export function dailyUsage() {
  const used = sentToday();
  return { used, limit: DEFAULT_DAILY_LIMIT, remaining: Math.max(0, DEFAULT_DAILY_LIMIT - used) };
}

/** True once this creator has been mailed successfully at least once. */
export function alreadyContacted(creatorId: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM outreach_messages WHERE creator_id = ? AND status = 'sent'`
    )
    .get(creatorId) as { c: number };
  return row.c > 0;
}

export function listMessages(limit = 100): OutreachMessage[] {
  const rows = getDb()
    .prepare(
      `SELECT m.*, c.name AS creator_name
         FROM outreach_messages m
         LEFT JOIN creators c ON c.id = m.creator_id
        ORDER BY m.created_at DESC
        LIMIT ?`
    )
    .all(limit) as Row[];
  return rows.map(map);
}

export function messagesForCreator(creatorId: string): OutreachMessage[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM outreach_messages WHERE creator_id = ? ORDER BY created_at DESC`
    )
    .all(creatorId) as Row[];
  return rows.map(map);
}

export function outreachStats() {
  const db = getDb();
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         COUNT(DISTINCT CASE WHEN status = 'sent' THEN creator_id END) AS creators
       FROM outreach_messages`
    )
    .get() as { total: number; sent: number | null; failed: number | null; creators: number };

  return {
    total: totals.total,
    sent: totals.sent ?? 0,
    failed: totals.failed ?? 0,
    creators: totals.creators,
  };
}
