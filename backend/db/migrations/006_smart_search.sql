CREATE INDEX IF NOT EXISTS posts_product_name_search_idx
  ON posts (lower(json_extract(payload, '$.productName')));
CREATE INDEX IF NOT EXISTS posts_brand_search_idx
  ON posts (lower(json_extract(payload, '$.brand')));
CREATE INDEX IF NOT EXISTS posts_model_search_idx
  ON posts (lower(json_extract(payload, '$.model')));
CREATE INDEX IF NOT EXISTS posts_model_name_search_idx
  ON posts (lower(json_extract(payload, '$.modelName')));
CREATE INDEX IF NOT EXISTS posts_subcategory_search_idx
  ON posts (lower(json_extract(payload, '$.subcategory')));
CREATE INDEX IF NOT EXISTS posts_description_search_idx
  ON posts (lower(json_extract(payload, '$.description')));
CREATE INDEX IF NOT EXISTS posts_tags_search_idx
  ON posts (lower(json_extract(payload, '$.tags')));
CREATE INDEX IF NOT EXISTS posts_keywords_search_idx
  ON posts (lower(json_extract(payload, '$.searchKeywords')));
CREATE INDEX IF NOT EXISTS posts_keyword_alias_search_idx
  ON posts (lower(json_extract(payload, '$.keywords')));
CREATE INDEX IF NOT EXISTS posts_attributes_search_idx
  ON posts (lower(json_extract(payload, '$.attributes')));
CREATE INDEX IF NOT EXISTS posts_store_search_idx
  ON posts (lower(json_extract(payload, '$.storeName')));
CREATE INDEX IF NOT EXISTS posts_location_search_idx
  ON posts (lower(json_extract(payload, '$.location')));
CREATE INDEX IF NOT EXISTS posts_category_search_idx
  ON posts (lower(category));
CREATE INDEX IF NOT EXISTS posts_search_status_created_idx
  ON posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_created_search_idx
  ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS users_username_search_idx
  ON users (lower(username));

CREATE TABLE IF NOT EXISTS search_analytics (
  query_key TEXT PRIMARY KEY NOT NULL,
  query TEXT NOT NULL,
  search_count INTEGER NOT NULL DEFAULT 0,
  no_result_count INTEGER NOT NULL DEFAULT 0,
  suggestion_count INTEGER NOT NULL DEFAULT 0,
  typo_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS search_analytics_popular_idx
  ON search_analytics (search_count DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS search_product_analytics (
  post_id TEXT PRIMARY KEY NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
