const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const mimeType = (file.mimetype || '').toLowerCase();
  if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    return cb(null, true);
  }
  cb(new Error('Only audio or video files are allowed'), false);
};

const uploadMessageMedia = multer({ storage, fileFilter }).fields([
  { name: 'audio', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

module.exports = uploadMessageMedia;
