const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// Opportunities (filtered where lead_status = 'Oppurtunity')
router.get('/opportunities', salesController.getOpportunities);

// Auto-suggest next Lead ID
router.get('/leads/next-id', salesController.getNextLeadId);

// Leads CRUD
router.get('/leads', salesController.getAllLeads);
router.post('/leads', salesController.createLead);
router.put('/leads/:id', salesController.updateLead);
router.delete('/leads/:id', salesController.deleteLead);

module.exports = router;
