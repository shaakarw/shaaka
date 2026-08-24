const express = require('express');
const router = express.Router();
const Note = require('../models/Note');   // same model, but with a `userId` field
const auth = require('../middleware/auth');

// ----------------------------------------------------------------------
// User routes – all operations are scoped to the logged‑in user
// ----------------------------------------------------------------------

// 1️⃣ GET – list only this user's notes
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user.id })
                            .sort({ createdAt: -1 });
    res.json({ success: true, notes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2️⃣ POST – create a note for this user
router.post('/', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const note = new Note({
      text,
      userId: req.user.id,   // associate with the user
    });
    await note.save();
    res.json({ success: true, note });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3️⃣ PUT – update only if the note belongs to this user
router.put('/:id', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const note = await Note.findOne({ _id: req.params.id, userId: req.user.id });
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found or not yours' });
    }

    note.text = text;
    await note.save();
    res.json({ success: true, note });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4️⃣ DELETE – delete only if the note belongs to this user
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await Note.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!result) {
      return res.status(404).json({ success: false, message: 'Note not found or not yours' });
    }
    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;