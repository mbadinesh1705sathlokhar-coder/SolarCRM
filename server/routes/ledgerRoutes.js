const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgerController');

// Client Payments routes
router.get('/payments', ledgerController.getAllPayments);
router.post('/payments', ledgerController.createPayment);
router.put('/payments/:id', ledgerController.updatePayment);
router.delete('/payments/site/:siteId', ledgerController.deletePaymentsBySiteId);
router.delete('/payments/:id', ledgerController.deletePayment);

// Site Expenses routes
router.get('/expenses', ledgerController.getAllExpenses);
router.post('/expenses', ledgerController.createExpense);
router.put('/expenses/:id', ledgerController.updateExpense);
router.delete('/expenses/site/:siteId', ledgerController.deleteExpensesBySiteId);
router.delete('/expenses/:id', ledgerController.deleteExpense);

// PO / WO Letterhead & Config routes
router.get('/po-wo/config', ledgerController.getPoWoConfig);
router.put('/po-wo/config', ledgerController.updatePoWoConfig);
router.post('/po-wo/letterhead', ledgerController.uploadPoWoLetterhead);
router.get('/po-wo/next-number', ledgerController.getNextPoWoNumber);

module.exports = router;
