// routes/postRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createPost,
  getAllPosts,
  getMyPosts,
  getSavedPosts,
  toggleSavePost,
  getUserPosts,
  getPostById,
  deletePost,
  searchPosts,
  getPopularSearches,
  trackSearchEvent,
} = require('../controllers/postController');

router.get('/search', searchPosts);
router.get('/search/popular', getPopularSearches);
router.post('/search/analytics', trackSearchEvent);
router.get('/', getAllPosts);
router.post('/', auth, upload.posts.fields([
  { name: 'images', maxCount: 10 },
  { name: 'video', maxCount: 1 },
]), createPost);
router.get('/me', auth, getMyPosts);
router.get('/saved', auth, getSavedPosts);
router.post('/save/:postId', auth, toggleSavePost);
router.get('/user/:userId', auth, getUserPosts);
router.get('/:postId', auth, getPostById);
router.delete('/:postId', auth, deletePost);

module.exports = router;