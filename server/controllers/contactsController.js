const { Meeting, CallLog, TaskItem } = require('../models/ContactActivity');
const { SitePlan } = require('../models/SitePlan');

// Seed contacts data if empty (disabled per user requirement - real-world manual entry)
async function seedContactsIfEmpty() {
    // Dummy contacts seeding disabled per user requirement: all activity data to be entered manually
}

// 1. Meetings Endpoints
const getMeetings = async (req, res) => {
    try {
        const meetings = await Meeting.findAll({
            order: [['date', 'ASC'], ['time', 'ASC']]
        });

        // Automatically fetch allocated Site Plans and include them under 'Site Plan' purpose
        const sitePlans = await SitePlan.findAll({
            order: [['date', 'ASC']]
        });

        const sitePlanMeetings = sitePlans.map(sp => ({
            id: -(sp.id), // Synthetic negative ID
            sitePlanId: sp.id,
            purpose: 'Site Plan',
            title: sp.clientName ? `Site Plan: ${sp.clientName}` : 'Site Inspection Plan',
            clientName: sp.clientName,
            engineer: sp.engineerName,
            description: sp.description,
            date: sp.date,
            time: sp.time || '10:00',
            coordinator: sp.assignedBy || 'Admin',
            location: 'On-site Inspection',
            status: 'Scheduled',
            isSitePlan: true,
            createdAt: sp.createdAt,
            updatedAt: sp.updatedAt
        }));

        const combined = [...meetings.map(m => m.toJSON()), ...sitePlanMeetings].sort((a, b) => {
            const da = `${a.date} ${a.time || '00:00'}`;
            const db = `${b.date} ${b.time || '00:00'}`;
            return da.localeCompare(db);
        });

        res.status(200).json(combined);
    } catch (err) {
        console.error('getMeetings error:', err);
        res.status(500).json({ error: 'Failed to retrieve meetings', details: err.message });
    }
};

const createMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.create(req.body);
        res.status(201).json(meeting);
    } catch (err) {
        res.status(400).json({ error: 'Failed to create meeting', details: err.message });
    }
};

const updateMeeting = async (req, res) => {
    try {
        const numId = parseInt(req.params.id, 10);
        if (numId < 0) {
            // Update backing SitePlan
            const spId = Math.abs(numId);
            const plan = await SitePlan.findByPk(spId);
            if (!plan) return res.status(404).json({ error: 'Site Plan record not found' });
            await plan.update({
                date: req.body.date,
                time: req.body.time || '10:00',
                engineerName: req.body.engineer,
                description: req.body.description,
                clientName: req.body.clientName
            });
            return res.status(200).json({
                id: numId,
                sitePlanId: plan.id,
                purpose: 'Site Plan',
                title: plan.clientName ? `Site Plan: ${plan.clientName}` : 'Site Inspection Plan',
                clientName: plan.clientName,
                engineer: plan.engineerName,
                description: plan.description,
                date: plan.date,
                time: plan.time || '10:00',
                coordinator: plan.assignedBy || 'Admin',
                location: 'On-site Inspection',
                status: 'Scheduled',
                isSitePlan: true
            });
        }

        const [updated] = await Meeting.update(req.body, { where: { id: numId } });
        if (!updated) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        const updatedMeeting = await Meeting.findByPk(numId);
        res.status(200).json(updatedMeeting);
    } catch (err) {
        res.status(400).json({ error: 'Failed to update meeting', details: err.message });
    }
};

const deleteMeeting = async (req, res) => {
    try {
        const numId = parseInt(req.params.id, 10);
        if (numId < 0) {
            // Delete backing SitePlan
            const spId = Math.abs(numId);
            const plan = await SitePlan.findByPk(spId);
            if (!plan) return res.status(404).json({ error: 'Site Plan not found' });
            await plan.destroy();
            return res.status(200).json({ message: 'Site Plan meeting deleted successfully' });
        }

        const deleted = await Meeting.destroy({ where: { id: numId } });
        if (!deleted) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        res.status(200).json({ message: 'Meeting deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete meeting', details: err.message });
    }
};

// 2. Calls Endpoints
const getCalls = async (req, res) => {
    try {
        const calls = await CallLog.findAll({
            order: [['date', 'DESC'], ['time', 'DESC']]
        });
        res.status(200).json(calls);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve call logs', details: err.message });
    }
};

const createCall = async (req, res) => {
    try {
        const call = await CallLog.create(req.body);
        res.status(201).json(call);
    } catch (err) {
        res.status(400).json({ error: 'Failed to log call', details: err.message });
    }
};

const updateCall = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await CallLog.update(req.body, { where: { id } });
        if (!updated) {
            return res.status(404).json({ error: 'Call log not found' });
        }
        const updatedCall = await CallLog.findByPk(id);
        res.status(200).json(updatedCall);
    } catch (err) {
        res.status(400).json({ error: 'Failed to update call log', details: err.message });
    }
};

const deleteCall = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await CallLog.destroy({ where: { id } });
        if (!deleted) {
            return res.status(404).json({ error: 'Call log not found' });
        }
        res.status(200).json({ message: 'Call log deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete call log', details: err.message });
    }
};

// 3. Tasks Endpoints
const getTasks = async (req, res) => {
    try {
        const tasks = await TaskItem.findAll({
            order: [['dueDate', 'ASC'], ['id', 'ASC']]
        });
        res.status(200).json(tasks);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve tasks', details: err.message });
    }
};

const createTask = async (req, res) => {
    try {
        if (!req.body.taskId) {
            const count = await TaskItem.count();
            req.body.taskId = `TSK-${100 + count + 1}`;
        }
        if (!req.body.status) {
            req.body.status = 'Pending';
        }
        const task = await TaskItem.create(req.body);
        res.status(201).json(task);
    } catch (err) {
        res.status(400).json({ error: 'Failed to create task', details: err.message });
    }
};

const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await TaskItem.findByPk(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // If status is changed, only the assigned employee (or Admin) can change it
        if (req.body.status && req.body.status !== task.status) {
            const userName = (req.query.userName || req.body.userName || '').trim().toLowerCase();
            const isAdmin = req.query.isAdmin === 'true' || req.body.isAdmin === true;
            const assignedTo = (task.assignedTo || '').trim().toLowerCase();

            if (!isAdmin && userName && assignedTo !== userName && !assignedTo.includes(userName) && !userName.includes(assignedTo)) {
                return res.status(403).json({ error: `Only the assigned employee (${task.assignedTo}) can change this task's status.` });
            }
        }

        await task.update(req.body);
        res.status(200).json(task);
    } catch (err) {
        res.status(400).json({ error: 'Failed to update task', details: err.message });
    }
};

const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await TaskItem.destroy({ where: { id } });
        if (!deleted) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete task', details: err.message });
    }
};

module.exports = {
    seedContactsIfEmpty,
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
};
