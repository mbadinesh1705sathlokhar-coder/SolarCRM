const express = require('express');
const router = express.Router();
const {
    getMeetings,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getCalls,
    createCall,
    updateCall,
    deleteCall,
    getTasks,
    createTask,
    updateTask,
    deleteTask
} = require('../controllers/contactsController');

// Meetings
router.get('/meetings', getMeetings);
router.post('/meetings', createMeeting);
router.put('/meetings/:id', updateMeeting);
router.delete('/meetings/:id', deleteMeeting);

// Calls
router.get('/calls', getCalls);
router.post('/calls', createCall);
router.put('/calls/:id', updateCall);
router.delete('/calls/:id', deleteCall);

// Tasks
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

module.exports = router;
