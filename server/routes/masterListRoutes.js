const express = require('express');
const router = express.Router();
const {
    getAllLists,
    getListByTitleOrId,
    createList,
    updateList,
    deleteList
} = require('../controllers/masterListController');

router.get('/', getAllLists);
router.get('/:idOrTitle', getListByTitleOrId);
router.post('/', createList);
router.put('/:id', updateList);
router.delete('/:id', deleteList);

module.exports = router;
