import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createAsset, deleteAsset, getAsset, listAssetsForTemplate } from "@/lib/db/assets";
import {
  extractAssetIds,
  isImageMimeType,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_IMAGE_BYTES,
  type ImageMimeType,
} from "@/lib/outreach/markup";
import type { EmailAsset } from "@/lib/types";

/**
 * Image files for templates.
 *
 * Bytes go to `data/uploads/<id>` (already gitignored) and the database keeps
 * only metadata. On send the bytes are attached as CID parts, so the image
 * reaches the recipient without the app being reachable from the internet.
 */

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export class AssetError extends Error {
  constructor(
    message: string,
    readonly code:
      | "empty_file"
      | "unsupported_type"
      | "too_large"
      | "total_too_large"
      | "invalid_image",
    readonly status: number
  ) {
    super(message);
    this.name = "AssetError";
  }
}

function filePath(id: string): string {
  return path.join(UPLOAD_DIR, id);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Trusts the bytes, not the browser-supplied content type. */
function detectImageMime(buffer: Buffer): ImageMimeType | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function sanitizeFilename(name: string | undefined): string {
  const base = (name ?? "image").split(/[\\/]/).pop() ?? "image";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
  return cleaned || "image";
}

export async function saveUploadedAsset(templateId: string, file: File): Promise<EmailAsset> {
  if (file.size <= 0) {
    throw new AssetError("The selected file is empty.", "empty_file", 400);
  }
  if (!isImageMimeType(file.type)) {
    throw new AssetError("Only PNG, JPEG, WebP and GIF images are supported.", "unsupported_type", 415);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new AssetError(
      `Each image must be ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB or smaller.`,
      "too_large",
      413
    );
  }

  const used = listAssetsForTemplate(templateId).reduce((sum, asset) => sum + asset.size, 0);
  if (used + file.size > MAX_TOTAL_IMAGE_BYTES) {
    throw new AssetError(
      `A template can hold ${Math.round(MAX_TOTAL_IMAGE_BYTES / (1024 * 1024))} MB of images in total.`,
      "total_too_large",
      413
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageMime(buffer);
  const declared = file.type.toLowerCase() === "image/jpg" ? "image/jpeg" : file.type.toLowerCase();
  if (!detected || detected !== declared) {
    throw new AssetError("That file does not look like a valid image.", "invalid_image", 415);
  }

  const id = randomUUID();
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(filePath(id), buffer, { mode: 0o600 });

  try {
    return createAsset({
      id,
      templateId,
      filename: sanitizeFilename(file.name),
      mime: detected,
      size: buffer.length,
    });
  } catch (error) {
    // A metadata failure must not leave a file nobody can ever find again.
    await fs.rm(filePath(id), { force: true });
    throw error;
  }
}

export async function readAssetFile(
  id: string
): Promise<{ asset: EmailAsset; buffer: Buffer } | null> {
  const asset = getAsset(id);
  if (!asset) return null;
  try {
    const buffer = await fs.readFile(filePath(id));
    return { asset, buffer };
  } catch {
    return null;
  }
}

/** Best effort: a missing file must not fail a delete or a save. */
export async function removeAssetFiles(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => fs.rm(filePath(id), { force: true }).catch(() => undefined)));
}

/** Drops uploads the saved body no longer references, so orphans do not pile up. */
export async function removeUnreferencedAssets(templateId: string, body: string): Promise<void> {
  const referenced = new Set(extractAssetIds(body));
  const stale = listAssetsForTemplate(templateId).filter((asset) => !referenced.has(asset.id));
  for (const asset of stale) deleteAsset(asset.id);
  await removeAssetFiles(stale.map((asset) => asset.id));
}
