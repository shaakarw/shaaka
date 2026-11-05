ALTER TABLE favorites ADD COLUMN shop_ref_id TEXT;
ALTER TABLE notifications ADD COLUMN post_ref_id TEXT;

UPDATE favorites
SET shop_ref_id = json_extract(payload, '$.shopId')
WHERE json_type(payload, '$.shopId') = 'text';

UPDATE notifications
SET post_ref_id = json_extract(payload, '$.postId')
WHERE json_type(payload, '$.postId') = 'text';

CREATE INDEX IF NOT EXISTS favorites_shop_ref_idx ON favorites (shop_ref_id);
CREATE INDEX IF NOT EXISTS notifications_post_ref_idx ON notifications (post_ref_id);
