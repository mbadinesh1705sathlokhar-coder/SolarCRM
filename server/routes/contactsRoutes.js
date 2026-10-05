const express = require('express');
const router = express.Router();
const {
    getMeetings,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    clearAllMeetings,
    getCalls,
    createCall,
    updateCall,
    deleteCall,
    clearAllCalls,
    getTasks,
    createTask,
    updateTask,
    deleteTask,
    clearAllTasks
} = require('../controllers/contactsController');

// Meetings
router.get('/meetings', getMeetings);
router.post('/meetings', createMeeting);
router.put('/meetings/:id', updateMeeting);
router.delete('/meetings/all', clearAllMeetings);
router.delete('/meetings/:id', deleteMeeting);

// Calls
router.get('/calls', getCalls);
router.post('/calls', createCall);
router.put('/calls/:id', updateCall);
router.delete('/calls/all', clearAllCalls);
router.delete('/calls/:id', deleteCall);

// Tasks
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/all', clearAllTasks);
router.delete('/tasks/:id', deleteTask);

module.exports = router;
