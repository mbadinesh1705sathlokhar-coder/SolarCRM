const express = require('express');
const router = express.Router();
const {
    getAllInvoiceBillings,
    getNextInvoiceNo,
    createInvoiceBilling,
    bulkCreateInvoiceBillings,
    updateInvoiceBilling,
    deleteInvoiceBilling
} = require('../controllers/invoiceBillingController');

router.get('/', getAllInvoiceBillings);
router.get('/next-number', getNextInvoiceNo);
router.post('/bulk', bulkCreateInvoiceBillings);
router.post('/', createInvoiceBilling);
router.put('/:id', updateInvoiceBilling);
router.delete('/:id', deleteInvoiceBilling);

module.exports = router;
