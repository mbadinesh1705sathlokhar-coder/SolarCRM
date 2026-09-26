const express = require('express');
const router = express.Router();
const officeController = require('../controllers/officeController');

// Auth Login
router.post('/login', officeController.loginEmployee);

// Employees CRUD
router.get('/employees', officeController.getAllEmployees);
router.get('/employees/:id', officeController.getEmployeeById);
router.post('/employees', officeController.createEmployee);
router.put('/employees/:id', officeController.updateEmployee);
router.delete('/employees/:id', officeController.deleteEmployee);

// Office Vendors CRUD
router.get('/vendors', officeController.getAllVendors);
router.post('/vendors', officeController.createVendor);
router.put('/vendors/:id', officeController.updateVendor);
router.delete('/vendors/:id', officeController.deleteVendor);

module.exports = router;
