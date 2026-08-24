const multer = require('multer');
const path = require('path');

// Memory storage – we process buffers directly
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed'), false);
  }
};

// Middleware: accepts up to 10 images, field name = 'images'
const upload = multer({ storage, fileFilter }).array('images', 10);

module.exports = upload;