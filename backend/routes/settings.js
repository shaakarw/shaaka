const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const AppSetting = require('../models/AppSetting');
const { adminAuth } = require('../middleware/adminAuth');
const storageService = require('../services/storage/storageService');
const {
  getTutorialStorageKeys,
  parseTutorialSections,
  serializeTutorialSections,
} = require('../utils/tutorialSettings');

const DEFAULT_CONTACT_INFO = {
  instagram: 'https://www.instagram.com/shaaka_rw/',
  youtube: 'https://www.youtube.com/@shaaka-rw',
  twitter: 'https://x.com/shaaka_rw',
  facebook: 'https://www.facebook.com/profile.php?id=61592686307072',
  email: 'shaakarw@gmail.com',
  whatsapp: '+250799882580',
  website: '',
  other: '',
  other2: '',
  other3: '',
  other4: '',
  other5: '',
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
}).array('images', 30);

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
    const sections = parseTutorialSections(setting?.value).map(section => ({
      id: section.id,
      title: section.title,
      images: section.images.map(image => ({
        url: storageService.getPublicMediaUrl(image.storageKey),
      })),
    }));
    return res.json({
      success: true,
      sections,
      tutorialImage: sections[0]?.images[0]
        ? { ...sections[0].images[0], updatedAt: setting.updatedAt }
        : null,
    });
  } catch (error) {
    console.error('Could not load tutorial image:', error);
    return res.status(500).json({ success: false, message: 'Could not load tutorial image.' });
  }
});

router.post('/tutorial-image', adminAuth, handleTutorialImageUpload, async (req, res) => {
  const uploadedStorageKeys = [];
  try {
    let submittedSections;
    try {
      submittedSections = JSON.parse(req.body?.sections || '');
    } catch {
      return res.status(400).json({ success: false, message: 'Tutorial sections must be valid JSON.' });
    }
    if (!Array.isArray(submittedSections) || submittedSections.length > 30) {
      return res.status(400).json({ success: false, message: 'Tutorial sections must be a list of up to 30 sections.' });
    }

    const previousSetting = await AppSetting.findOne({ key: 'tutorialimage' }).lean();
    const previousSections = parseTutorialSections(previousSetting?.value);
    const existingKeys = new Set(getTutorialStorageKeys(previousSections));
    const usedStorageKeys = new Set();
    const usedUploadIndexes = new Set();
    const sectionIds = new Set();
    const normalizedSections = [];
    let imageCount = 0;

    for (const section of submittedSections) {
      if (!section || typeof section.id !== 'string' || !section.id.trim()
        || typeof section.title !== 'string' || !section.title.trim() || section.title.trim().length > 100
        || !Array.isArray(section.images) || sectionIds.has(section.id.trim())) {
        return res.status(400).json({ success: false, message: 'Each tutorial section needs an ID, a title, and an image list.' });
      }
      sectionIds.add(section.id.trim());

      const images = [];
      for (const image of section.images) {
        imageCount += 1;
        if (imageCount > 30 || !image || typeof image !== 'object') {
          return res.status(400).json({ success: false, message: 'A tutorial can contain up to 30 images.' });
        }

        if (Number.isInteger(image.uploadIndex)
          && image.uploadIndex >= 0
          && image.uploadIndex < (req.files || []).length
          && !usedUploadIndexes.has(image.uploadIndex)) {
          usedUploadIndexes.add(image.uploadIndex);
          images.push({ uploadIndex: image.uploadIndex });
        } else if (typeof image.storageKey === 'string'
          && existingKeys.has(image.storageKey)
          && !usedStorageKeys.has(image.storageKey)) {
          usedStorageKeys.add(image.storageKey);
          images.push({ storageKey: image.storageKey });
        } else {
          return res.status(400).json({ success: false, message: 'A tutorial image is invalid or no longer available.' });
        }
      }

      normalizedSections.push({
        id: section.id.trim(),
        title: section.title.trim(),
        images,
      });
    }

    if (usedUploadIndexes.size !== (req.files || []).length) {
      return res.status(400).json({ success: false, message: 'One or more uploaded images are not assigned to a section.' });
    }

    for (const section of normalizedSections) {
      for (const image of section.images) {
        if (image.uploadIndex === undefined) continue;
        const file = req.files[image.uploadIndex];
        const uploadResult = await storageService.uploadMedia({
          buffer: file.buffer,
          mimeType: file.mimetype,
          folder: 'tutorial',
          maxBytes: TUTORIAL_IMAGE_MAX_BYTES,
        });
        uploadedStorageKeys.push(uploadResult.storageKey);
        image.storageKey = uploadResult.storageKey;
        delete image.uploadIndex;
      }
    }

    const sections = normalizedSections.map(section => ({
      id: section.id,
      title: section.title,
      images: section.images.map(image => ({
        url: storageService.getPublicMediaUrl(image.storageKey),
        storageKey: image.storageKey,
      })),
    }));

    await AppSetting.findOneAndUpdate(
      { key: 'tutorialimage' },
      {
        key: 'tutorialimage',
        value: serializeTutorialSections(normalizedSections),
        description: 'Public tutorial sections and image storage keys',
        updatedBy: req.user?._id || null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const retainedKeys = new Set(getTutorialStorageKeys(normalizedSections));
    for (const previousKey of getTutorialStorageKeys(previousSections)) {
      if (retainedKeys.has(previousKey)) continue;
      try {
        await storageService.deleteMedia(previousKey);
      } catch (cleanupError) {
        console.error('Could not delete a removed tutorial image:', cleanupError);
      }
    }

    return res.json({ success: true, sections });
  } catch (error) {
    for (const storageKey of uploadedStorageKeys) {
      try {
        await storageService.deleteMedia(storageKey);
      } catch (cleanupError) {
        console.error('Could not clean up an unsaved tutorial image:', cleanupError);
      }
    }
    console.error('Could not save tutorial sections:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Could not save tutorial sections.',
    });
  }
});

router.delete('/tutorial-image', adminAuth, async (req, res) => {
  try {
    const setting = await AppSetting.findOneAndDelete({ key: 'tutorialimage' });
    if (setting?.value) {
      for (const storageKey of getTutorialStorageKeys(parseTutorialSections(setting.value))) {
        await storageService.deleteMedia(storageKey);
      }
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
