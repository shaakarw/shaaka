const express = require('express');
const router = express.Router();
const businessIdeasController = require('../controllers/businessIdeasController');
const { adminAuth } = require('../middleware/adminAuth');

// ---- Public routes ----
router.get('/business-ideas', businessIdeasController.getBusinessIdeas);
router.get('/job-openings', businessIdeasController.getJobOpenings);
router.get('/skill-courses', businessIdeasController.getSkillCourses);
router.get('/all', businessIdeasController.getAllBusinessIdeas);

// ---- Admin routes ----
router.post('/admin/:type', adminAuth, businessIdeasController.createItem);
router.put('/admin/:type/:id', adminAuth, businessIdeasController.updateItem);
router.delete('/admin/:type/:id', adminAuth, businessIdeasController.deleteItem);

module.exports = router;