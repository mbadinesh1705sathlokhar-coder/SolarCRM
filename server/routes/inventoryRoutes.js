const express = require('express');
const router = express.Router();
const {
    getAllIndents,
    getIndentById,
    createIndent,
    updateIndent,
    deleteIndent,
    getAllWarehouseMaterials,
    createWarehouseMaterial,
    updateWarehouseMaterial,
    deleteWarehouseMaterial,
    getAllGatePasses,
    createGatePass,
    updateGatePass,
    deleteGatePass,
    getCartItems,
    createCartItem,
    updateCartItem,
    deleteCartItem
} = require('../controllers/inventoryController');

// 1. Indent Routes
router.get('/indents', getAllIndents);
router.get('/indents/:id', getIndentById);
router.post('/indents', createIndent);
router.put('/indents/:id', updateIndent);
router.delete('/indents/:id', deleteIndent);

// 2. Warehouse Routes
router.get('/warehouse', getAllWarehouseMaterials);
router.post('/warehouse', createWarehouseMaterial);
router.put('/warehouse/:id', updateWarehouseMaterial);
router.delete('/warehouse/:id', deleteWarehouseMaterial);

// 3. Gate Pass Routes
router.get('/gate-pass', getAllGatePasses);
router.post('/gate-pass', createGatePass);
router.put('/gate-pass/:id', updateGatePass);
router.delete('/gate-pass/:id', deleteGatePass);

// 4. Add to Cart Routes
router.get('/cart', getCartItems);
router.post('/cart', createCartItem);
router.put('/cart/:id', updateCartItem);
router.delete('/cart/:id', deleteCartItem);

module.exports = router;
