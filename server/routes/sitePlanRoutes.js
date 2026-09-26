const express = require('express');
const router = express.Router();
const { getAllSitePlans, createSitePlan, updateSitePlan, deleteSitePlan } = require('../controllers/sitePlanController');

router.get('/', getAllSitePlans);
router.post('/', createSitePlan);
router.put('/:id', updateSitePlan);
router.delete('/:id', deleteSitePlan);

module.exports = router;
