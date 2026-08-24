// middleware/upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|gif/;
  const videoTypes = /mp4|mov|quicktime|mkv|webm|avi/;
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (file.fieldname === 'images') {
    const extname = imageTypes.test(extension);
    const mimetype = imageTypes.test(mimeType);
    if (mimetype && extname) return cb(null, true);
    return cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed'), false);
  }

  if (file.fieldname === 'video') {
    const extname = videoTypes.test(extension);
    const mimetype = videoTypes.test(mimeType);
    if (mimetype || extname) return cb(null, true);
    return cb(new Error('Only video files (mp4, mov, mkv, webm, avi) are allowed'), false);
  }

  cb(new Error('Unsupported file field'), false);
};

// ✅ Export the multer instance, NOT the result of .array()
const upload = multer({ storage, fileFilter });

module.exports = upload;