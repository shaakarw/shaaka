const express = require('express');
const storageService = require('../services/storage/storageService');

const router = express.Router();
const PUBLIC_PREFIXES = [
  /^shaaka\/posts\//,
  /^shaaka\/places\//,
  /^shaaka\/business\//,
  /^shaaka\/users\/[^/]+\/(profile|stories)\//,
];

router.get('/*key', async (req, res) => {
  const keyParam = req.params.key;
  const key = Array.isArray(keyParam) ? keyParam.join('/') : String(keyParam || '');
  if (!storageService.isStorageKey(key)) {
    return res.status(404).json({ success: false, message: 'Media not found' });
  }

  const isPublic = PUBLIC_PREFIXES.some(prefix => prefix.test(key));
  if (!isPublic && !storageService.verifyPrivateMediaUrl(key, req.query.expires, req.query.signature)) {
    return res.status(403).json({ success: false, message: 'Media URL is invalid or expired' });
  }

  try {
    const object = await storageService.getMediaObject(key, req.headers.range);
    res.status(object.ContentRange ? 206 : 200);
    res.set('Accept-Ranges', 'bytes');
    res.set('Content-Type', object.ContentType || 'application/octet-stream');
    res.set('Cache-Control', isPublic ? 'public, max-age=86400' : 'private, max-age=3600');
    if (object.ContentLength != null) res.set('Content-Length', String(object.ContentLength));
    if (object.ContentRange) res.set('Content-Range', object.ContentRange);
    if (object.ETag) res.set('ETag', object.ETag);
    object.Body.on('error', error => {
      console.error('[Storage] Media stream failed:', error.name || 'StreamError');
      if (!res.headersSent) res.status(502).end();
      else res.destroy(error);
    });
    object.Body.pipe(res);
  } catch (error) {
    if (error.code === 'OBJECT_NOT_FOUND') return res.status(404).json({ success: false, message: 'Media not found' });
    console.error('[Storage] Media download failed:', error.code || 'B2_OPERATION_FAILED');
    res.status(error.statusCode || 502).json({ success: false, message: 'Media could not be retrieved' });
  }
});

module.exports = router;