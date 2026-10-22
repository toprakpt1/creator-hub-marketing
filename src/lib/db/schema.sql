-- Chest Blade Creator Hub — local schema (SQLite).
--
-- Phase 1 stores YouTube creators only, but the shape is platform-agnostic:
-- `creators` holds the product-level record and `youtube_channels` holds the
-- platform payload, so TikTok/Instagram tables can sit alongside it later
-- without reshaping anything the UI reads.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS creators (
  id                    TEXT PRIMARY KEY,
  platform              TEXT NOT NULL DEFAULT 'youtube',
  -- Platform identity. UNIQUE is what makes deduplication impossible to get
  -- wrong: the same channel can never be inserted twice, whatever the route.
  youtube_channel_id    TEXT UNIQUE,
  name                  TEXT NOT NULL,
  handle                TEXT,
  description           TEXT,
  thumbnail_url         TEXT,
  country               TEXT,

  subscriber_count        INTEGER,
  subscriber_count_hidden INTEGER NOT NULL DEFAULT 0,
  channel_total_views     INTEGER,
  channel_video_count     INTEGER,
  uploads_playlist_id     TEXT,
  channel_published_at    TEXT,

  -- Locally computed from analysed videos; NULL until an analysis has run.
  average_views          INTEGER,
  median_views           INTEGER,
  max_recent_views       INTEGER,
  min_recent_views       INTEGER,
  average_likes          INTEGER,
  average_comments       INTEGER,
  videos_analyzed        INTEGER NOT NULL DEFAULT 0,
  view_to_subscriber_ratio REAL,
  uploads_last_30_days   INTEGER,
  uploads_last_90_days   INTEGER,
  days_since_last_upload INTEGER,
  last_upload_at         TEXT,

  creator_score          INTEGER,
  score_breakdown        TEXT,          -- JSON
  is_rising              INTEGER NOT NULL DEFAULT 0,

  status                 TEXT NOT NULL DEFAULT 'new',

  email                  TEXT,
  email_source           TEXT NOT NULL DEFAULT 'none',
  email_status           TEXT NOT NULL DEFAULT 'not_checked',

  discovered_at          TEXT NOT NULL,
  last_synced_at         TEXT,
  videos_synced_at       TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creators_score      ON creators(creator_score DESC);
CREATE INDEX IF NOT EXISTS idx_creators_subs       ON creators(subscriber_count);
CREATE INDEX IF NOT EXISTS idx_creators_ratio      ON creators(view_to_subscriber_ratio DESC);
CREATE INDEX IF NOT EXISTS idx_creators_status     ON creators(status);
CREATE INDEX IF NOT EXISTS idx_creators_discovered ON creators(discovered_at DESC);

-- Many-to-many: one creator can be found by several keywords across runs.
CREATE TABLE IF NOT EXISTS creator_keywords (
  creator_id  TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  keyword     TEXT NOT NULL,
  first_seen  TEXT NOT NULL,
  PRIMARY KEY (creator_id, keyword)
);

CREATE TABLE IF NOT EXISTS youtube_videos (
  video_id      TEXT PRIMARY KEY,
  creator_id    TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  published_at  TEXT NOT NULL,
  thumbnail_url TEXT,
  view_count    INTEGER,
  like_count    INTEGER,
  comment_count INTEGER,
  duration      TEXT,
  fetched_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_videos_creator ON youtube_videos(creator_id, published_at DESC);

-- One row per Discover search, so we can see which keywords actually pay off.
CREATE TABLE IF NOT EXISTS discovery_runs (
  id                       TEXT PRIMARY KEY,
  keyword                  TEXT NOT NULL,
  region                   TEXT,
  language                 TEXT,
  published_after          TEXT,
  requested_results        INTEGER NOT NULL,
  min_subscribers          INTEGER,
  max_subscribers          INTEGER,
  page_token               TEXT,
  next_page_token          TEXT,
  raw_results              INTEGER NOT NULL DEFAULT 0,
  unique_channels_found    INTEGER NOT NULL DEFAULT 0,
  existing_creators_found  INTEGER NOT NULL DEFAULT 0,
  creators_passing_filter  INTEGER NOT NULL DEFAULT 0,
  new_creators_added       INTEGER NOT NULL DEFAULT 0,
  creators_deep_analyzed   INTEGER NOT NULL DEFAULT 0,
  quota_units_used         INTEGER NOT NULL DEFAULT 0,
  api_requests             INTEGER NOT NULL DEFAULT 0,
  -- Cached candidate payload, so re-opening a run costs no quota.
  candidates_json          TEXT,
  cache_key                TEXT NOT NULL,
  error                    TEXT,
  started_at               TEXT NOT NULL,
  completed_at             TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_started   ON discovery_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_cache_key ON discovery_runs(cache_key, started_at DESC);

-- Every outbound YouTube call, with its documented quota cost.
CREATE TABLE IF NOT EXISTS api_usage (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint    TEXT NOT NULL,
  quota_units INTEGER NOT NULL,
  run_id      TEXT,
  day         TEXT NOT NULL,   -- YYYY-MM-DD in UTC, matches Google's reset
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_day ON api_usage(day, endpoint);

-- ------------------------------------------------------------------
-- Grouping surfaces. These are plain CRUD over creators we already have —
-- no outreach automation, which stays out of phase 1.
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS creator_lists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#1283d3',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS list_members (
  list_id    TEXT NOT NULL REFERENCES creator_lists(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  added_at   TEXT NOT NULL,
  PRIMARY KEY (list_id, creator_id)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  goal        TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',
  owner       TEXT,
  start_date  TEXT,
  end_date    TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_members (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id  TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  added_at    TEXT NOT NULL,
  PRIMARY KEY (campaign_id, creator_id)
);

CREATE TABLE IF NOT EXISTS email_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  language    TEXT NOT NULL DEFAULT 'English',
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Images uploaded for a template. The bytes live in data/uploads/<id>, so the
-- database never carries multi-megabyte blobs. A send turns each row into a
-- CID part, which is why no public URL is needed for the image to show up.
CREATE TABLE IF NOT EXISTS email_assets (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_assets_template ON email_assets(template_id);

-- ------------------------------------------------------------------
-- Outreach. One row per message we actually handed to the mail server,
-- so the panel can show what was sent, to whom and what came back.
-- Nothing here is written before a send is attempted.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_messages (
  id             TEXT PRIMARY KEY,
  creator_id     TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  template_id    TEXT REFERENCES email_templates(id) ON DELETE SET NULL,
  campaign_id    TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  to_email       TEXT NOT NULL,
  from_email     TEXT NOT NULL,
  subject        TEXT NOT NULL,
  body           TEXT NOT NULL,
  -- queued -> sent | failed. A row only ever leaves 'queued' once the SMTP
  -- server has answered, so 'sent' means the server accepted it.
  status         TEXT NOT NULL DEFAULT 'queued',
  provider_id    TEXT,
  error          TEXT,
  sent_at        TEXT,
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outreach_creator ON outreach_messages(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_day ON outreach_messages(sent_at);

-- ------------------------------------------------------------------
-- Connected mail account. Exactly one row (id = 1) in this phase.
-- Tokens are AES-256-GCM encrypted before they reach this table, so a
-- database copy alone cannot be used to send mail as the user.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mail_account (
  id                      INTEGER PRIMARY KEY CHECK (id = 1),
  provider                TEXT NOT NULL DEFAULT 'gmail',
  email                   TEXT NOT NULL,
  -- The display name recipients see. Filled from the Google profile on
  -- connect, then editable in Settings (a game studio, not the account name).
  from_name               TEXT,
  refresh_token_enc       TEXT NOT NULL,
  access_token_enc        TEXT,
  access_token_expires_at INTEGER,
  scope                   TEXT,
  connected_at            TEXT NOT NULL,
  last_verified_at        TEXT,
  last_error              TEXT
);

-- ------------------------------------------------------------------
-- The game the templates talk about. Exactly one row (id = 1).
-- Kept in the database rather than in a source constant so the name and
-- the store link can be changed from Settings without a rebuild — and so
-- the panel preview and the outgoing mail resolve the same values.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  game_name   TEXT NOT NULL DEFAULT '',
  game_link   TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL
);
