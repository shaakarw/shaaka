const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const AppSetting = require('../models/AppSetting');
const { adminAuth } = require('../middleware/adminAuth');
const storageService = require('../services/storage/storageService');

const DEFAULT_CONTACT_INFO = {
  instagram: 'https://www.instagram.com/shaaka_rw/',
  youtube: 'https://www.youtube.com/@shaaka-rw',
  twitter: 'https://x.com/shaaka_rw',
  facebook: 'https://www.facebook.com/profile.php?id=61592686307072',
  tiktok: '',
  email: 'shaakarw@gmail.com',
  whatsapp: '+250799882580',
  phone: '+250796640462',
  alternatePhone: '+250799882580',
  website: '',
  other: '',
};
const CONTACT_INFO_KEYS = Object.keys(DEFAULT_CONTACT_INFO);

const TUTORIAL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const tutorialImageTypes = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};
const uploadTutorialImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TUTORIAL_IMAGE_MAX_BYTES },
  fileFilter: (req, file, callback) => {
    const mimeType = String(file.mimetype || '').toLowerCase();
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (tutorialImageTypes[mimeType]?.includes(extension)) return callback(null, true);
    return callback(new Error('Only JPEG, PNG, WEBP, or GIF tutorial images are allowed.'));
  },
}).single('image');

const handleTutorialImageUpload = (req, res, next) => {
  uploadTutorialImage(req, res, (error) => {
    if (!error) return next();
    const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ success: false, message: error.message });
  });
};

const normalizeShareLink = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

router.get('/contact-info', async (req, res) => {
  try {
    const setting = await AppSetting.findOne({ key: 'contactinfo' }).lean();
    let savedContactInfo = {};
    if (setting?.value) {
      try {
        savedContactInfo = JSON.parse(setting.value);
      } catch (parseError) {
        console.error('Stored contact information is invalid JSON:', parseError);
        return res.status(500).json({ success: false, message: 'Could not load contact information.' });
      }
    }

    return res.json({
      success: true,
      contactInfo: { ...DEFAULT_CONTACT_INFO, ...savedContactInfo },
    });
  } catch (error) {
    console.error('Could not load contact information:', error);
    return res.status(500).json({ success: false, message: 'Could not load contact information.' });
  }
});

router.put('/contact-info', adminAuth, async (req, res) => {
  try {
    const submittedContactInfo = req.body?.contactInfo;
    if (!submittedContactInfo || typeof submittedContactInfo !== 'object' || Array.isArray(submittedContactInfo)) {
      return res.status(400).json({ success: false, message: 'Contact information must be an object.' });
    }

    const contactInfo = {};
    for (const key of CONTACT_INFO_KEYS) {
      const value = submittedContactInfo[key] ?? '';
      if (typeof value !== 'string' || value.length > 300) {
        return res.status(400).json({ success: false, message: `Invalid contact information for ${key}.` });
      }
      contactInfo[key] = value.trim();
    }

    const setting = await AppSetting.findOneAndUpdate(
      { key: 'contactinfo' },
      {
        key: 'contactinfo',
        value: JSON.stringify(contactInfo),
        description: 'Public contact and social media information',
        updatedBy: req.user?._id || null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, contactInfo, updatedAt: setting.updatedAt });
  } catch (error) {
    console.error('Could not save contact information:', error);
    return res.status(500).json({ success: false, message: 'Could not save contact information.' });
  }
});

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

router.get('/tutorial-image', async (req, res) => {
  try {
    const setting = await AppSetting.findOne({ key: 'tutorialimage' }).lean();
    const url = setting?.value ? storageService.getPublicMediaUrl(setting.value) : null;
    return res.json({
      success: true,
      tutorialImage: url ? { url, updatedAt: setting.updatedAt } : null,
    });
  } catch (error) {
    console.error('Could not load tutorial image:', error);
    return res.status(500).json({ success: false, message: 'Could not load tutorial image.' });
  }
});

router.post('/tutorial-image', adminAuth, handleTutorialImageUpload, async (req, res) => {
  let uploadedStorageKey = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Choose an image to upload.' });
    }

    const uploadResult = await storageService.uploadMedia({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      folder: 'tutorial',
      maxBytes: TUTORIAL_IMAGE_MAX_BYTES,
    });
    uploadedStorageKey = uploadResult.storageKey;
    const url = storageService.getPublicMediaUrl(uploadedStorageKey);
    const previousSetting = await AppSetting.findOne({ key: 'tutorialimage' }).lean();

    await AppSetting.findOneAndUpdate(
      { key: 'tutorialimage' },
      {
        key: 'tutorialimage',
        value: uploadedStorageKey,
        description: 'Public tutorial image storage key',
        updatedBy: req.user?._id || null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    uploadedStorageKey = null;

    if (previousSetting?.value && previousSetting.value !== uploadResult.storageKey) {
      try {
        await storageService.deleteMedia(previousSetting.value);
      } catch (cleanupError) {
        console.error('Could not delete the replaced tutorial image:', cleanupError);
      }
    }

    return res.json({ success: true, tutorialImage: { url } });
  } catch (error) {
    if (uploadedStorageKey) {
      try {
        await storageService.deleteMedia(uploadedStorageKey);
      } catch (cleanupError) {
        console.error('Could not clean up an unsaved tutorial image:', cleanupError);
      }
    }
    console.error('Could not save tutorial image:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Could not save tutorial image.',
    });
  }
});

router.delete('/tutorial-image', adminAuth, async (req, res) => {
  try {
    const setting = await AppSetting.findOneAndDelete({ key: 'tutorialimage' });
    if (setting?.value) {
      await storageService.deleteMedia(setting.value);
    }
    return res.json({ success: true, tutorialImage: null });
  } catch (error) {
    console.error('Could not remove tutorial image:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Could not remove tutorial image.',
    });
  }
});

module.exports = router;
