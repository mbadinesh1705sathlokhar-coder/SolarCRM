const express = require('express');
const router = express.Router();
const vendorLedgerController = require('../controllers/vendorLedgerController');

// Vendor CRUD
router.get('/', vendorLedgerController.getAllVendors);
router.post('/', vendorLedgerController.createVendor);
router.get('/:id', vendorLedgerController.getVendorWithLedger);
router.put('/:id', vendorLedgerController.updateVendor);
router.delete('/:id', vendorLedgerController.deleteVendor);

// PO / WO CRUD
router.get('/:id/po-wo', vendorLedgerController.getVendorPoWos);
router.post('/:id/po-wo', vendorLedgerController.createVendorPoWo);
router.put('/:id/po-wo/:poWoId', vendorLedgerController.updateVendorPoWo);
router.delete('/:id/po-wo/:poWoId', vendorLedgerController.deleteVendorPoWo);

// Payments Made (DR) CRUD
router.get('/:id/payments', vendorLedgerController.getVendorPayments);
router.post('/:id/payments', vendorLedgerController.createVendorPayment);
router.put('/:id/payments/:paymentId', vendorLedgerController.updateVendorPayment);
router.delete('/:id/payments/:paymentId', vendorLedgerController.deleteVendorPayment);

module.exports = router;
