const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');

// Campaigns CRUD
router.get('/', campaignController.getAllCampaigns);
router.post('/', campaignController.createCampaign);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

// Campaign Leads
router.get('/:campaignId/leads', campaignController.getCampaignLeads);
router.post('/:campaignId/leads', campaignController.createCampaignLead);
router.put('/leads/:id', campaignController.updateCampaignLead);
router.delete('/leads/:id', campaignController.deleteCampaignLead);

// Campaign Expenses
router.get('/all-expenses', campaignController.getAllCampaignExpenses);
router.post('/all-expenses', campaignController.createExpoExpense);
router.post('/expenses', campaignController.createExpoExpense);
router.get('/:campaignId/expenses', campaignController.getCampaignExpenses);
router.post('/:campaignId/expenses', campaignController.createCampaignExpense);
router.put('/expenses/:id', campaignController.updateCampaignExpense);
router.delete('/expenses/:id', campaignController.deleteCampaignExpense);

module.exports = router;
