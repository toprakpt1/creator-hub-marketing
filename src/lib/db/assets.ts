import { getDb, nowIso } from "@/lib/db/client";
import type { EmailAsset } from "@/lib/types";

/**
 * Template image metadata. The bytes themselves are written by
 * `lib/outreach/assets.ts`; this module only keeps the bookkeeping so a
 * template knows which files belong to it.
 */

interface AssetRow {
  id: string;
  template_id: string;
  filename: string;
  mime: string;
  size: number;
  created_at: string;
}

function mapAsset(row: AssetRow): EmailAsset {
  return {
    id: row.id,
    templateId: row.template_id,
    filename: row.filename,
    mime: row.mime,
    size: row.size,
    createdAt: row.created_at,
  };
}

export function listAssetsForTemplate(templateId: string): EmailAsset[] {
  return (
    getDb()
      .prepare(`SELECT * FROM email_assets WHERE template_id = ? ORDER BY created_at`)
      .all(templateId) as AssetRow[]
  ).map(mapAsset);
}

export function getAsset(id: string): EmailAsset | null {
  const row = getDb().prepare(`SELECT * FROM email_assets WHERE id = ?`).get(id) as
    | AssetRow
    | undefined;
  return row ? mapAsset(row) : null;
}

export function createAsset(input: {
  id: string;
  templateId: string;
  filename: string;
  mime: string;
  size: number;
}): EmailAsset {
  getDb()
    .prepare(
      `INSERT INTO email_assets (id, template_id, filename, mime, size, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(input.id, input.templateId, input.filename, input.mime, input.size, nowIso());
  return getAsset(input.id)!;
}

export function deleteAsset(id: string): boolean {
  return getDb().prepare(`DELETE FROM email_assets WHERE id = ?`).run(id).changes > 0;
}
