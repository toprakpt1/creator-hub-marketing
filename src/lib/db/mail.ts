import "server-only";
import { getDb, nowIso } from "@/lib/db/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { MailAccountSummary } from "@/lib/types";

/**
 * The single connected mail account.
 *
 * One row, enforced by `CHECK (id = 1)`. Tokens never leave this module in
 * decrypted form except to the Gmail client; the UI only ever sees a summary.
 */

interface Row {
  id: number;
  provider: string;
  email: string;
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: number | null;
  scope: string | null;
  connected_at: string;
  last_verified_at: string | null;
  last_error: string | null;
}

export interface MailAccount extends MailAccountSummary {
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  scope: string | null;
}

function summaryOf(row: Row): MailAccountSummary {
  return {
    provider: "gmail",
    email: row.email,
    connectedAt: row.connected_at,
    lastVerifiedAt: row.last_verified_at,
    needsReconnect: Boolean(row.last_error),
    lastError: row.last_error,
  };
}

/** Decrypted account for the mailer. Never handed to a route or component. */
export function getMailAccount(): MailAccount | null {
  const row = getDb().prepare("SELECT * FROM mail_account WHERE id = 1").get() as Row | undefined;
  if (!row) return null;

  try {
    return {
      ...summaryOf(row),
      refreshToken: decryptSecret(row.refresh_token_enc),
      accessToken: row.access_token_enc ? decryptSecret(row.access_token_enc) : null,
      accessTokenExpiresAt: row.access_token_expires_at,
      scope: row.scope,
    };
  } catch (e) {
    // A key change or a corrupted row must not silently look "connected".
    markMailAccountError(
      e instanceof Error ? e.message : "Stored Gmail token could not be read."
    );
    return null;
  }
}

export function getMailAccountSummary(): MailAccountSummary | null {
  const row = getDb().prepare("SELECT * FROM mail_account WHERE id = 1").get() as Row | undefined;
  return row ? summaryOf(row) : null;
}

export function saveMailAccount(input: {
  email: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  scope: string | null;
}): void {
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO mail_account
         (id, provider, email, refresh_token_enc, access_token_enc,
          access_token_expires_at, scope, connected_at, last_verified_at, last_error)
       VALUES (1, 'gmail', ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET
         provider = 'gmail',
         email = excluded.email,
         refresh_token_enc = excluded.refresh_token_enc,
         access_token_enc = excluded.access_token_enc,
         access_token_expires_at = excluded.access_token_expires_at,
         scope = excluded.scope,
         connected_at = excluded.connected_at,
         last_verified_at = excluded.last_verified_at,
         last_error = NULL`
    )
    .run(
      input.email,
      encryptSecret(input.refreshToken),
      encryptSecret(input.accessToken),
      input.accessTokenExpiresAt,
      input.scope,
      now,
      now
    );
}

export function updateMailAccessToken(accessToken: string, expiresAt: number): void {
  getDb()
    .prepare(
      `UPDATE mail_account
          SET access_token_enc = ?, access_token_expires_at = ?, last_error = NULL
        WHERE id = 1`
    )
    .run(encryptSecret(accessToken), expiresAt);
}

export function markMailAccountVerified(): void {
  getDb()
    .prepare("UPDATE mail_account SET last_verified_at = ?, last_error = NULL WHERE id = 1")
    .run(nowIso());
}

export function markMailAccountError(message: string): void {
  getDb().prepare("UPDATE mail_account SET last_error = ? WHERE id = 1").run(message);
}

export function clearMailAccount(): void {
  getDb().prepare("DELETE FROM mail_account WHERE id = 1").run();
}
