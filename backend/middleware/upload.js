// middleware/upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const imageTypes = /^image\//;
  const videoTypes = /^video\//;
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (file.fieldname === 'images') {
    if (imageTypes.test(mimeType) && extension) return cb(null, true);
    return cb(new Error('Only supported image files are allowed'), false);
  }

  if (file.fieldname === 'video') {
    if (videoTypes.test(mimeType) && extension) return cb(null, true);
    return cb(new Error('Only supported video files are allowed'), false);
  }

  if (file.fieldname === 'thumbnail') {
    if (imageTypes.test(mimeType) && extension) return cb(null, true);
    return cb(new Error('Only supported thumbnail images are allowed'), false);
  }

  cb(new Error('Unsupported file field'), false);
};

// ✅ Export the multer instance, NOT the result of .array()
const upload = multer({ storage, fileFilter });

module.exports = upload;