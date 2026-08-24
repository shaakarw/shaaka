const multer = require('multer');
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio/')) cb(null, true);
  else cb(new Error('Only audio files are allowed'), false);
};

const uploadAudio = multer({ storage, fileFilter }).single('audio');

module.exports = uploadAudio;