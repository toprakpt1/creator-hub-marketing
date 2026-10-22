import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Symmetric encryption for secrets at rest (currently the Gmail tokens).
 *
 * AES-256-GCM so a tampered ciphertext fails loudly instead of decrypting into
 * garbage. The key comes from `MAIL_TOKEN_KEY` when set; otherwise a random key
 * is generated next to the SQLite database with 0600 permissions. That keeps a
 * local install zero-config without ever writing tokens in the clear.
 */

const PREFIX = "v1";
const ALGORITHM = "aes-256-gcm";

function dataDirectory(): string {
  const configured = process.env.DATABASE_PATH ?? "./data/creator-hub.db";
  const dbPath = path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
  return path.dirname(dbPath);
}

function readKeyFile(file: string): Buffer {
  const stored = Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
  if (stored.length !== 32) {
    throw new Error(`The mail token key at ${file} is corrupt. Delete it to generate a new one.`);
  }
  return stored;
}

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.MAIL_TOKEN_KEY?.trim();
  if (fromEnv) {
    // Accept base64 or hex; both are common ways to paste 32 bytes.
    const asBase64 = Buffer.from(fromEnv, "base64");
    if (asBase64.length === 32) {
      cachedKey = asBase64;
      return cachedKey;
    }
    const asHex = Buffer.from(fromEnv, "hex");
    if (asHex.length === 32) {
      cachedKey = asHex;
      return cachedKey;
    }
    throw new Error("MAIL_TOKEN_KEY must be 32 bytes, encoded as base64 or hex.");
  }

  const dir = dataDirectory();
  const file = path.join(dir, ".mail-token-key");
  if (fs.existsSync(file)) {
    cachedKey = readKeyFile(file);
    return cachedKey;
  }

  fs.mkdirSync(dir, { recursive: true });
  const generated = crypto.randomBytes(32);
  fs.writeFileSync(file, generated.toString("base64"), { mode: 0o600 });
  cachedKey = generated;
  return cachedKey;
}

/** Returns `v1.<iv>.<tag>.<ciphertext>`, all base64url. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, loadKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(
    "."
  );
}

export function decryptSecret(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(".");
  if (version !== PREFIX || !ivPart || !tagPart || !dataPart) {
    throw new Error("Stored secret has an unknown format. Reconnect the account.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, loadKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
