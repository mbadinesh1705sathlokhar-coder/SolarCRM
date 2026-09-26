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

module.exports = router;
