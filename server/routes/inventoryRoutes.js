const express = require('express');
const router = express.Router();
const {
    getAllIndents,
    getIndentById,
    createIndent,
    updateIndent,
    deleteIndent,
    deleteAllIndents,
    getAllWarehouseMaterials,
    createWarehouseMaterial,
    updateWarehouseMaterial,
    deleteWarehouseMaterial,
    deleteAllWarehouseMaterials,
    getAllGatePasses,
    createGatePass,
    updateGatePass,
    deleteGatePass,
    deleteAllGatePasses,
    getCartItems,
    createCartItem,
    updateCartItem,
    deleteCartItem,
    deleteAllCartItems
} = require('../controllers/inventoryController');

// 1. Indent Routes
router.get('/indents', getAllIndents);
router.delete('/indents/all', deleteAllIndents);
router.get('/indents/:id', getIndentById);
router.post('/indents', createIndent);
router.put('/indents/:id', updateIndent);
router.delete('/indents/:id', deleteIndent);

// 2. Warehouse Routes
router.get('/warehouse', getAllWarehouseMaterials);
router.delete('/warehouse/all', deleteAllWarehouseMaterials);
router.post('/warehouse', createWarehouseMaterial);
router.put('/warehouse/:id', updateWarehouseMaterial);
router.delete('/warehouse/:id', deleteWarehouseMaterial);

// 3. Gate Pass Routes
router.get('/gate-pass', getAllGatePasses);
router.delete('/gate-pass/all', deleteAllGatePasses);
router.post('/gate-pass', createGatePass);
router.put('/gate-pass/:id', updateGatePass);
router.delete('/gate-pass/:id', deleteGatePass);

// 4. Add to Cart Routes
router.get('/cart', getCartItems);
router.delete('/cart/all', deleteAllCartItems);
router.post('/cart', createCartItem);
router.put('/cart/:id', updateCartItem);
router.delete('/cart/:id', deleteCartItem);

module.exports = router;
