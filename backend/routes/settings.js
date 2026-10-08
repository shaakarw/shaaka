const express = require('express');
const router = express.Router();
const AppSetting = require('../models/AppSetting');
const { adminAuth } = require('../middleware/adminAuth');

const normalizeShareLink = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

router.get('/share-link', async (req, res) => {
  try {
    const setting = await AppSetting.findOne({ key: 'sharelink' });
    res.json({
      success: true,
      shareLink: setting?.value || '',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/share-link', adminAuth, async (req, res) => {
  try {
    const shareLink = normalizeShareLink(req.body?.shareLink);

    if (req.body?.shareLink && shareLink && !/^https?:\/\/[\w.-]+(?:\.[\w.-]+)+(?:[\w.,@?^=%&:/~+#-]*)*$/.test(shareLink)) {
      return res.status(400).json({ success: false, message: 'Share link is invalid' });
    }

    const setting = await AppSetting.findOneAndUpdate(
      { key: 'sharelink' },
      {
        key: 'sharelink',
        value: shareLink,
        description: 'Public share link for app shares',
        updatedBy: req.user?._id || null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, shareLink: setting.value, setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
