const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const auth = require('../middleware/auth');

// ----------------------------------------------------------------------
// Admin routes – notes are public to view, but only admin can create/edit/delete
// ----------------------------------------------------------------------

// 1️⃣ GET – public, anyone can view all notes
router.get('/', async (req, res) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 });
    res.json({ success: true, notes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const normalizeLink = (link) => {
  let value = String(link || '').trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  return value;
};

const isValidLink = (link) => {
  return /^https?:\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&:/~+#-]*)?$/.test(link);
};

// 2️⃣ POST – admin only, create a new note
router.post('/', auth, async (req, res) => {
  try {
    const { text, link } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }
    const normalizedLink = normalizeLink(link);
    if (link && normalizedLink && !isValidLink(normalizedLink)) {
      return res.status(400).json({ success: false, message: 'Link is invalid' });
    }
    const note = new Note({ text, link: normalizedLink });
    await note.save();
    res.json({ success: true, note });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3️⃣ PUT – admin only, edit a note by ID
router.put('/:id', auth, async (req, res) => {
  try {
    const { text, link } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const normalizedLink = normalizeLink(link);
    if (link && normalizedLink && !isValidLink(normalizedLink)) {
      return res.status(400).json({ success: false, message: 'Link is invalid' });
    }

    const note = await Note.findByIdAndUpdate(
      req.params.id,
      { text, link: normalizedLink },
      { new: true, runValidators: true }
    );

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    res.json({ success: true, note });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4️⃣ DELETE – admin only, delete a note by ID
router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;