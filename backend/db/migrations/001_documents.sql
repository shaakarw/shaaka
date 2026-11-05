CREATE TABLE IF NOT EXISTS documents (
  collection_name TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_json TEXT NOT NULL CHECK (json_valid(document_json)),
  PRIMARY KEY (collection_name, document_id)
);

CREATE INDEX IF NOT EXISTS documents_collection_idx
  ON documents (collection_name);

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
  ON documents (json_extract(document_json, '$.phone'))
  WHERE collection_name = 'users'
    AND json_type(document_json, '$.phone') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
  ON documents (json_extract(document_json, '$.username'))
  WHERE collection_name = 'users'
    AND json_type(document_json, '$.username') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_id_number_unique_idx
  ON documents (json_extract(document_json, '$.idNumber'))
  WHERE collection_name = 'users'
    AND json_type(document_json, '$.idNumber') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_key_unique_idx
  ON documents (json_extract(document_json, '$.userId'), json_extract(document_json, '$.eventKey'))
  WHERE collection_name = 'notifications'
    AND json_type(document_json, '$.eventKey') = 'text';
