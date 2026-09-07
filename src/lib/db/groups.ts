import { randomUUID } from "node:crypto";
import { getDb, nowIso } from "@/lib/db/client";
import type { Campaign, CreatorList, EmailTemplate } from "@/lib/types";

/**
 * Lists, campaigns and templates.
 *
 * These are plain groupings over creators that already exist locally — no
 * outreach sending, no automation. The funnel numbers a campaign shows are
 * derived from real creator statuses, never invented.
 */

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

const LIST_SELECT = `
  SELECT l.*, (
    SELECT COUNT(*) FROM list_members m WHERE m.list_id = l.id
  ) AS member_count
  FROM creator_lists l
`;

interface ListRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  member_count: number;
}

function mapList(row: ListRow): CreatorList {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    memberCount: row.member_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCreatorLists(): CreatorList[] {
  return (getDb().prepare(`${LIST_SELECT} ORDER BY l.created_at DESC`).all() as ListRow[]).map(
    mapList
  );
}

export function getCreatorList(id: string): CreatorList | null {
  const row = getDb().prepare(`${LIST_SELECT} WHERE l.id = ?`).get(id) as ListRow | undefined;
  return row ? mapList(row) : null;
}

export function createCreatorList(name: string, description: string | null, color?: string) {
  const id = randomUUID();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO creator_lists (id, name, description, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, name, description, color ?? "#1283d3", now, now);
  return getCreatorList(id)!;
}

export function updateCreatorList(id: string, name: string, description: string | null) {
  getDb()
    .prepare(`UPDATE creator_lists SET name = ?, description = ?, updated_at = ? WHERE id = ?`)
    .run(name, description, nowIso(), id);
  return getCreatorList(id);
}

export function deleteCreatorList(id: string) {
  return getDb().prepare(`DELETE FROM creator_lists WHERE id = ?`).run(id).changes > 0;
}

/** Adds creators to a list, ignoring any that are already members. */
export function addCreatorsToList(listId: string, creatorIds: string[]) {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO list_members (list_id, creator_id, added_at) VALUES (?, ?, ?)`
  );
  let added = 0;
  db.transaction(() => {
    for (const creatorId of creatorIds) {
      added += insert.run(listId, creatorId, nowIso()).changes;
    }
  })();
  return added;
}

export function removeCreatorFromList(listId: string, creatorId: string) {
  return (
    getDb()
      .prepare(`DELETE FROM list_members WHERE list_id = ? AND creator_id = ?`)
      .run(listId, creatorId).changes > 0
  );
}

export function listMemberIds(listId: string): string[] {
  return (
    getDb()
      .prepare(`SELECT creator_id FROM list_members WHERE list_id = ?`)
      .all(listId) as { creator_id: string }[]
  ).map((r) => r.creator_id);
}

/** Which lists a creator belongs to — shown on the creator profile. */
export function listsForCreator(creatorId: string): CreatorList[] {
  return (
    getDb()
      .prepare(
        `${LIST_SELECT} JOIN list_members m ON m.list_id = l.id WHERE m.creator_id = ?
         ORDER BY l.name`
      )
      .all(creatorId) as ListRow[]
  ).map(mapList);
}

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

interface CampaignRow {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
}

const CAMPAIGN_SELECT = `
  SELECT c.*, (
    SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id = c.id
  ) AS member_count
  FROM campaigns c
`;

/**
 * Funnel counts come from the real pipeline status of member creators. Stages
 * later than "added" are zero until outreach exists — which is honest, not a
 * placeholder.
 */
function campaignFunnel(campaignId: string) {
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS added,
         SUM(CASE WHEN cr.status IN ('qualified','shortlisted','ready_to_contact','contacted','replied','interested','accepted','content_published') THEN 1 ELSE 0 END) AS qualified,
         SUM(CASE WHEN cr.status IN ('contacted','replied','interested','accepted','content_published') THEN 1 ELSE 0 END) AS contacted,
         SUM(CASE WHEN cr.status IN ('replied','interested','accepted','content_published') THEN 1 ELSE 0 END) AS replied,
         SUM(CASE WHEN cr.status IN ('interested','accepted','content_published') THEN 1 ELSE 0 END) AS interested,
         SUM(CASE WHEN cr.status IN ('accepted','content_published') THEN 1 ELSE 0 END) AS accepted,
         SUM(CASE WHEN cr.status = 'content_published' THEN 1 ELSE 0 END) AS published
       FROM campaign_members m
       JOIN creators cr ON cr.id = m.creator_id
       WHERE m.campaign_id = ?`
    )
    .get(campaignId) as Record<string, number | null>;

  return {
    added: row.added ?? 0,
    qualified: row.qualified ?? 0,
    contacted: row.contacted ?? 0,
    replied: row.replied ?? 0,
    interested: row.interested ?? 0,
    accepted: row.accepted ?? 0,
    published: row.published ?? 0,
  };
}

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    status: row.status as Campaign["status"],
    owner: row.owner,
    startDate: row.start_date,
    endDate: row.end_date,
    memberCount: row.member_count,
    funnel: campaignFunnel(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCampaigns(): Campaign[] {
  return (
    getDb().prepare(`${CAMPAIGN_SELECT} ORDER BY c.created_at DESC`).all() as CampaignRow[]
  ).map(mapCampaign);
}

export function getCampaign(id: string): Campaign | null {
  const row = getDb().prepare(`${CAMPAIGN_SELECT} WHERE c.id = ?`).get(id) as
    | CampaignRow
    | undefined;
  return row ? mapCampaign(row) : null;
}

export function createCampaign(name: string, goal: string | null) {
  const id = randomUUID();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO campaigns (id, name, goal, status, owner, start_date, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', NULL, ?, ?, ?)`
    )
    .run(id, name, goal, now, now, now);
  return getCampaign(id)!;
}

export function updateCampaignStatus(id: string, status: Campaign["status"]) {
  getDb()
    .prepare(`UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?`)
    .run(status, nowIso(), id);
  return getCampaign(id);
}

export function deleteCampaign(id: string) {
  return getDb().prepare(`DELETE FROM campaigns WHERE id = ?`).run(id).changes > 0;
}

export function addCreatorsToCampaign(campaignId: string, creatorIds: string[]) {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO campaign_members (campaign_id, creator_id, added_at) VALUES (?, ?, ?)`
  );
  let added = 0;
  db.transaction(() => {
    for (const creatorId of creatorIds) {
      added += insert.run(campaignId, creatorId, nowIso()).changes;
    }
  })();
  return added;
}

export function campaignMemberIds(campaignId: string): string[] {
  return (
    getDb()
      .prepare(`SELECT creator_id FROM campaign_members WHERE campaign_id = ?`)
      .all(campaignId) as { creator_id: string }[]
  ).map((r) => r.creator_id);
}

export function campaignsForCreator(creatorId: string): Campaign[] {
  return (
    getDb()
      .prepare(
        `${CAMPAIGN_SELECT} JOIN campaign_members m ON m.campaign_id = c.id
         WHERE m.creator_id = ? ORDER BY c.name`
      )
      .all(creatorId) as CampaignRow[]
  ).map(mapCampaign);
}

/* ------------------------------------------------------------------ */
/* Email templates                                                     */
/* ------------------------------------------------------------------ */

interface TemplateRow {
  id: string;
  name: string;
  language: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const mapTemplate = (r: TemplateRow): EmailTemplate => ({
  id: r.id,
  name: r.name,
  language: r.language,
  subject: r.subject,
  body: r.body,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function listTemplates(): EmailTemplate[] {
  return (
    getDb().prepare(`SELECT * FROM email_templates ORDER BY created_at`).all() as TemplateRow[]
  ).map(mapTemplate);
}

export function getTemplate(id: string): EmailTemplate | null {
  const row = getDb().prepare(`SELECT * FROM email_templates WHERE id = ?`).get(id) as
    | TemplateRow
    | undefined;
  return row ? mapTemplate(row) : null;
}

export function createTemplate(
  name: string,
  language: string,
  subject: string,
  body: string
) {
  const id = randomUUID();
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO email_templates (id, name, language, subject, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, name, language, subject, body, now, now);
  return getTemplate(id)!;
}

export function updateTemplate(
  id: string,
  fields: { name?: string; language?: string; subject?: string; body?: string }
) {
  const current = getTemplate(id);
  if (!current) return null;
  getDb()
    .prepare(
      `UPDATE email_templates SET name = ?, language = ?, subject = ?, body = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      fields.name ?? current.name,
      fields.language ?? current.language,
      fields.subject ?? current.subject,
      fields.body ?? current.body,
      nowIso(),
      id
    );
  return getTemplate(id);
}

export function deleteTemplate(id: string) {
  return getDb().prepare(`DELETE FROM email_templates WHERE id = ?`).run(id).changes > 0;
}
