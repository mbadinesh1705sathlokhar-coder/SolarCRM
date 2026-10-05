const express = require('express');
const router = express.Router();
const {
    getAllBomMaterials,
    saveMaterialGroupSpecs,
    createBomMaterialItem,
    deleteBomMaterialItem,
    syncMaterialGroupsWithUom
} = require('../controllers/bomMaterialController');

router.get('/', getAllBomMaterials);
router.post('/bulk-save', saveMaterialGroupSpecs);
router.post('/sync-groups', syncMaterialGroupsWithUom);
router.post('/', createBomMaterialItem);
router.delete('/:id', deleteBomMaterialItem);

module.exports = router;
