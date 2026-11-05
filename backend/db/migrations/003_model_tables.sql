CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  phone TEXT UNIQUE,
  username TEXT UNIQUE,
  id_number TEXT UNIQUE,
  role TEXT,
  blocked INTEGER,
  plan TEXT,
  subscription_status TEXT,
  created_at TEXT,
  updated_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT,
  created_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  status TEXT,
  trending INTEGER,
  featured INTEGER,
  price REAL,
  created_at TEXT,
  updated_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT,
  type TEXT,
  created_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS mallshops (
  id TEXT PRIMARY KEY NOT NULL,
  mall_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_date TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  receiver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  post_id TEXT,
  client_message_id TEXT UNIQUE,
  read INTEGER,
  created_at TEXT,
  updated_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS savedposts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  saved_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id TEXT REFERENCES places(id) ON DELETE CASCADE,
  shop_id TEXT REFERENCES shops(id) ON DELETE CASCADE,
  type TEXT,
  created_at TEXT,
  updated_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY NOT NULL,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  ignored INTEGER,
  created_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  shop_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  place_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  shopping_mall_id TEXT REFERENCES places(id) ON DELETE SET NULL,
  mall_shop_id TEXT REFERENCES mallshops(id) ON DELETE SET NULL,
  message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  event_key TEXT,
  delivery_status TEXT,
  is_read INTEGER,
  created_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  UNIQUE (user_id, event_key)
);

CREATE TABLE IF NOT EXISTS businessideas (
  id TEXT PRIMARY KEY NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT,
  published INTEGER,
  created_at TEXT,
  updated_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS devicetokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT,
  token TEXT UNIQUE,
  status TEXT,
  platform TEXT,
  last_seen_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  UNIQUE (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT,
  created_at TEXT,
  expires_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS appsettings (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT UNIQUE,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT,
  expires_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS status (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  updated_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  user_a_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  user_b_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT,
  updated_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  created_at TEXT,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE INDEX IF NOT EXISTS posts_user_created_idx ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_feed_idx ON posts (status, trending DESC, featured DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS places_user_idx ON places (user_id);
CREATE INDEX IF NOT EXISTS mallshops_owner_created_idx ON mallshops (owner_id, created_date DESC);
CREATE INDEX IF NOT EXISTS mallshops_mall_created_idx ON mallshops (mall_id, created_date DESC);
CREATE INDEX IF NOT EXISTS messages_sender_created_idx ON messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_receiver_created_idx ON messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_post_sender_receiver_idx ON messages (post_id, sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS savedposts_user_saved_idx ON savedposts (user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS favorites_user_type_idx ON favorites (user_id, type);
CREATE INDEX IF NOT EXISTS reports_post_idx ON reports (post_id);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_delivery_retry_idx ON notifications (delivery_status, created_at);
CREATE INDEX IF NOT EXISTS businessideas_category_published_created_idx ON businessideas (category, published, created_at DESC);
CREATE INDEX IF NOT EXISTS devicetokens_user_status_idx ON devicetokens (user_id, status);
CREATE INDEX IF NOT EXISTS notes_user_created_idx ON notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_user_created_idx ON stories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_users_idx ON conversations (user_a_id, user_b_id);

INSERT OR IGNORE INTO users (id, phone, username, id_number, role, blocked, plan, subscription_status, created_at, updated_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.phone'), json_extract(document_json, '$.username'),
       json_extract(document_json, '$.idNumber'), json_extract(document_json, '$.role'), json_extract(document_json, '$.blocked'),
       json_extract(document_json, '$.plan'), json_extract(document_json, '$.subscriptionStatus'),
       json_extract(document_json, '$.createdAt'), json_extract(document_json, '$.updatedAt'), document_json
FROM documents WHERE collection_name = 'users';

INSERT OR IGNORE INTO places (id, user_id, category, created_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.userId'),
       json_extract(document_json, '$.category'), json_extract(document_json, '$.createdAt'), document_json
FROM documents WHERE collection_name = 'places';

INSERT OR IGNORE INTO posts (id, user_id, category, status, trending, featured, price, created_at, updated_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.user'), json_extract(document_json, '$.category'),
       json_extract(document_json, '$.status'), json_extract(document_json, '$.trending'), json_extract(document_json, '$.featured'),
       json_extract(document_json, '$.price'), json_extract(document_json, '$.createdAt'), json_extract(document_json, '$.updatedAt'), document_json
FROM documents WHERE collection_name = 'posts';

INSERT OR IGNORE INTO shops (id, owner_id, status, type, created_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.owner'),
       json_extract(document_json, '$.status'), json_extract(document_json, '$.type'),
       json_extract(document_json, '$.createdAt'), document_json
FROM documents WHERE collection_name = 'shops';

INSERT OR IGNORE INTO mallshops (id, mall_id, owner_id, created_date, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.mallId'),
       json_extract(document_json, '$.ownerId'), json_extract(document_json, '$.createdDate'), document_json
FROM documents WHERE collection_name = 'mallshops';

INSERT OR IGNORE INTO messages (id, sender_id, receiver_id, post_id, client_message_id, read, created_at, updated_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.senderId'), json_extract(document_json, '$.receiverId'),
       json_extract(document_json, '$.postId'), json_extract(document_json, '$.clientMessageId'), json_extract(document_json, '$.read'),
       json_extract(document_json, '$.createdAt'), json_extract(document_json, '$.updatedAt'), document_json
FROM documents WHERE collection_name = 'messages';

INSERT OR IGNORE INTO savedposts (id, user_id, post_id, saved_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.user'),
       json_extract(document_json, '$.post'), json_extract(document_json, '$.savedAt'), document_json
FROM documents WHERE collection_name = 'savedposts';

INSERT OR IGNORE INTO favorites (id, user_id, place_id, shop_id, type, created_at, updated_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.userId'),
       json_extract(document_json, '$.placeId'),
       CASE WHEN EXISTS (SELECT 1 FROM shops WHERE id = json_extract(documents.document_json, '$.shopId'))
            THEN json_extract(document_json, '$.shopId') ELSE NULL END,
       json_extract(document_json, '$.type'),
       json_extract(document_json, '$.createdAt'), json_extract(document_json, '$.updatedAt'), document_json
FROM documents WHERE collection_name = 'favorites';

INSERT OR IGNORE INTO reports (id, reporter_id, post_id, ignored, created_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.reporter'),
       json_extract(document_json, '$.post'), json_extract(document_json, '$.ignored'),
       json_extract(document_json, '$.createdAt'), document_json
FROM documents WHERE collection_name = 'reports';

INSERT OR IGNORE INTO notifications (id, user_id, sender_id, post_id, shop_id, place_id, shopping_mall_id, mall_shop_id, message_id, event_key, delivery_status, is_read, created_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.userId'), json_extract(document_json, '$.senderId'),
       CASE WHEN EXISTS (SELECT 1 FROM posts WHERE id = json_extract(documents.document_json, '$.postId'))
            THEN json_extract(document_json, '$.postId') ELSE NULL END,
       CASE WHEN EXISTS (SELECT 1 FROM places WHERE id = json_extract(documents.document_json, '$.shopId'))
            THEN json_extract(document_json, '$.shopId') ELSE NULL END,
       CASE WHEN EXISTS (SELECT 1 FROM places WHERE id = json_extract(documents.document_json, '$.placeId'))
            THEN json_extract(document_json, '$.placeId') ELSE NULL END,
       json_extract(document_json, '$.shoppingMallId'), json_extract(document_json, '$.mallShopId'), json_extract(document_json, '$.messageId'),
       json_extract(document_json, '$.eventKey'), json_extract(document_json, '$.deliveryStatus'), json_extract(document_json, '$.isRead'),
       json_extract(document_json, '$.createdAt'), document_json
FROM documents WHERE collection_name = 'notifications';

INSERT OR IGNORE INTO businessideas (id, created_by, updated_by, category, published, created_at, updated_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.createdBy'),
       json_extract(document_json, '$.updatedBy'), json_extract(document_json, '$.category'),
       json_extract(document_json, '$.published'), json_extract(document_json, '$.createdAt'),
       json_extract(document_json, '$.updatedAt'), document_json
FROM documents WHERE collection_name = 'businessideas';

INSERT OR IGNORE INTO devicetokens (id, user_id, device_id, token, status, platform, last_seen_at, created_at, updated_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.userId'),
       json_extract(document_json, '$.deviceId'), json_extract(document_json, '$.token'),
       json_extract(document_json, '$.status'), json_extract(document_json, '$.platform'),
       json_extract(document_json, '$.lastSeenAt'), json_extract(document_json, '$.createdAt'),
       json_extract(document_json, '$.updatedAt'), document_json
FROM documents WHERE collection_name = 'devicetokens';

INSERT OR IGNORE INTO subscriptions (id, user_id, status, created_at, expires_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.user'),
       json_extract(document_json, '$.status'), json_extract(document_json, '$.createdAt'),
       json_extract(document_json, '$.expiresAt'), document_json
FROM documents WHERE collection_name = 'subscriptions';

INSERT OR IGNORE INTO appsettings (id, key, updated_by, updated_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.key'),
       json_extract(document_json, '$.updatedBy'), json_extract(document_json, '$.updatedAt'), document_json
FROM documents WHERE collection_name = 'appsettings';

INSERT OR IGNORE INTO notes (id, user_id, created_at, expires_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.userId'),
       json_extract(document_json, '$.createdAt'), json_extract(document_json, '$.expiresAt'), document_json
FROM documents WHERE collection_name = 'notes';

INSERT OR IGNORE INTO status (id, user_id, updated_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.userId'),
       json_extract(document_json, '$.updatedAt'), document_json
FROM documents WHERE collection_name = 'status';

INSERT OR IGNORE INTO stories (id, user_id, created_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.userId'),
       json_extract(document_json, '$.createdAt'), document_json
FROM documents WHERE collection_name = 'stories';

INSERT OR IGNORE INTO conversations (id, user_a_id, user_b_id, created_at, updated_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.userAId'),
       json_extract(document_json, '$.userBId'), json_extract(document_json, '$.createdAt'),
       json_extract(document_json, '$.updatedAt'), document_json
FROM documents WHERE collection_name = 'conversations';

INSERT OR IGNORE INTO videos (id, user_id, post_id, created_at, payload)
SELECT json_extract(document_json, '$._id'), json_extract(document_json, '$.userId'),
       json_extract(document_json, '$.postId'), json_extract(document_json, '$.createdAt'), document_json
FROM documents WHERE collection_name = 'videos';
