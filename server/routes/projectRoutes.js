const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

// Summary KPI metrics
router.get('/summary', projectController.getSummaryMetrics);
router.get('/summary/metrics', projectController.getSummaryMetrics);

// Projects CRUD
router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.post('/', projectController.createProject);
router.put('/:id', projectController.updateProject);
router.patch('/:id/milestone', projectController.toggleMilestone);
router.delete('/:id', projectController.deleteProject);

module.exports = router;
