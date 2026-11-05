CREATE UNIQUE INDEX IF NOT EXISTS savedposts_user_post_unique_idx
  ON documents (json_extract(document_json, '$.user'), json_extract(document_json, '$.post'))
  WHERE collection_name = 'savedposts'
    AND json_type(document_json, '$.user') IS NOT NULL
    AND json_type(document_json, '$.post') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_place_unique_idx
  ON documents (json_extract(document_json, '$.userId'), json_extract(document_json, '$.placeId'))
  WHERE collection_name = 'favorites'
    AND json_type(document_json, '$.placeId') IS NOT NULL
    AND json_type(document_json, '$.placeId') != 'null';

CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_shop_unique_idx
  ON documents (json_extract(document_json, '$.userId'), json_extract(document_json, '$.shopId'))
  WHERE collection_name = 'favorites'
    AND json_type(document_json, '$.shopId') IS NOT NULL
    AND json_type(document_json, '$.shopId') != 'null';

CREATE UNIQUE INDEX IF NOT EXISTS statuses_user_unique_idx
  ON documents (json_extract(document_json, '$.userId'))
  WHERE collection_name = 'statuses'
    AND json_type(document_json, '$.userId') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS appsettings_key_unique_idx
  ON documents (json_extract(document_json, '$.key'))
  WHERE collection_name = 'appsettings'
    AND json_type(document_json, '$.key') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS devicetokens_token_unique_idx
  ON documents (json_extract(document_json, '$.token'))
  WHERE collection_name = 'devicetokens'
    AND json_type(document_json, '$.token') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS devicetokens_user_device_unique_idx
  ON documents (json_extract(document_json, '$.userId'), json_extract(document_json, '$.deviceId'))
  WHERE collection_name = 'devicetokens'
    AND json_type(document_json, '$.userId') IS NOT NULL
    AND json_type(document_json, '$.deviceId') IS NOT NULL;
