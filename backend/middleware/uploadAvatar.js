const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const extname = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(file.originalname);
  const mimetype = (file.mimetype || '').toLowerCase().startsWith('image/');
  if (mimetype && extname) return cb(null, true);
  cb(new Error('Only supported image files are allowed'), false);
};

const uploadAvatar = multer({ storage, fileFilter }).single('avatar');

module.exports = uploadAvatar;