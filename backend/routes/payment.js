const express = require('express');
const router = express.Router();

router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'This feature is not available in this version of the app.'
  });
});

module.exports = router;