CREATE TABLE IF NOT EXISTS daily_permission_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  usage_day TEXT NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, permission_key, usage_day)
);

CREATE TABLE IF NOT EXISTS lifetime_permission_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS daily_permission_usage_day_idx
  ON daily_permission_usage (usage_day, permission_key);

CREATE TABLE IF NOT EXISTS message_image_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  message_id TEXT,
  uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS message_image_uploads_owner_date_idx
  ON message_image_uploads (user_id, uploaded_at);

CREATE INDEX IF NOT EXISTS message_image_uploads_message_idx
  ON message_image_uploads (message_id);

UPDATE users SET payload = json_set(payload, '$.postUploadLimitPerDay', 4)
WHERE json_type(payload, '$.postUploadLimitPerDay') IS NULL;
UPDATE users SET payload = json_set(payload, '$.shopUploadLimitLifetime', 1)
WHERE json_type(payload, '$.shopUploadLimitLifetime') IS NULL;
UPDATE users SET payload = json_set(payload, '$.placeProductUploadLimitPerDay', 4)
WHERE json_type(payload, '$.placeProductUploadLimitPerDay') IS NULL;
UPDATE users SET payload = json_set(payload, '$.mallShopUploadLimitLifetime', 1)
WHERE json_type(payload, '$.mallShopUploadLimitLifetime') IS NULL;
UPDATE users SET payload = json_set(payload, '$.mallProductUploadLimitPerDay', 4)
WHERE json_type(payload, '$.mallProductUploadLimitPerDay') IS NULL;
UPDATE users SET payload = json_set(payload, '$.imagesPerMessage', 18)
WHERE json_type(payload, '$.imagesPerMessage') IS NULL;
UPDATE users SET payload = json_set(payload, '$.imagesRetentionDays', 15)
WHERE json_type(payload, '$.imagesRetentionDays') IS NULL;
UPDATE users SET payload = json_set(payload, '$.messagesRetentionDays', 30)
WHERE json_type(payload, '$.messagesRetentionDays') IS NULL;
UPDATE users SET payload = json_set(payload, '$.videoUploadLimitPerDay', 1)
WHERE json_type(payload, '$.videoUploadLimitPerDay') IS NULL;
UPDATE users SET payload = json_set(payload, '$.allowVideoUpload', true)
WHERE json_type(payload, '$.allowVideoUpload') IS NULL;

INSERT OR IGNORE INTO lifetime_permission_usage (user_id, permission_key, used, updated_at)
SELECT user_id, 'shops_places', COUNT(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM places
WHERE user_id IS NOT NULL
GROUP BY user_id;

INSERT OR IGNORE INTO lifetime_permission_usage (user_id, permission_key, used, updated_at)
SELECT owner_id, 'mall_shops', COUNT(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM mallshops
GROUP BY owner_id;

INSERT OR IGNORE INTO daily_permission_usage (user_id, permission_key, usage_day, used, updated_at)
SELECT user_id, 'posts', date('now', '+2 hours'), COUNT(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM posts
WHERE user_id IS NOT NULL AND date(created_at, '+2 hours') = date('now', '+2 hours')
GROUP BY user_id;

INSERT OR IGNORE INTO daily_permission_usage (user_id, permission_key, usage_day, used, updated_at)
SELECT user_id, 'videos', date('now', '+2 hours'), COUNT(*), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM posts
WHERE user_id IS NOT NULL
  AND json_extract(payload, '$.videoUrl') IS NOT NULL
  AND json_extract(payload, '$.videoUrl') != ''
  AND date(created_at, '+2 hours') = date('now', '+2 hours')
GROUP BY user_id;

INSERT OR IGNORE INTO daily_permission_usage (user_id, permission_key, usage_day, used, updated_at)
SELECT user_id, 'place_products', date('now', '+2 hours'),
       SUM(json_array_length(COALESCE(json_extract(payload, '$.products'), '[]'))),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM places
WHERE user_id IS NOT NULL AND date(created_at, '+2 hours') = date('now', '+2 hours')
GROUP BY user_id
HAVING SUM(json_array_length(COALESCE(json_extract(payload, '$.products'), '[]'))) > 0;

INSERT OR IGNORE INTO daily_permission_usage (user_id, permission_key, usage_day, used, updated_at)
SELECT owner_id, 'mall_products', date('now', '+2 hours'),
       SUM(json_array_length(COALESCE(json_extract(payload, '$.products'), '[]'))),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM mallshops
WHERE date(created_date, '+2 hours') = date('now', '+2 hours')
GROUP BY owner_id
HAVING SUM(json_array_length(COALESCE(json_extract(payload, '$.products'), '[]'))) > 0;
