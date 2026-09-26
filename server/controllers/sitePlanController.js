const { SitePlan } = require('../models/SitePlan');
const { Op } = require('sequelize');

// GET all site plans (filtered by user unless admin)
exports.getAllSitePlans = async (req, res) => {
    try {
        const { userName, isAdmin } = req.query;
        let whereClause = {};
        if (isAdmin !== 'true' && userName) {
            const cleanUser = userName.trim();
            whereClause = {
                [Op.or]: [
                    { assigned_by: { [Op.like]: `%${cleanUser}%` } },
                    { engineer_name: { [Op.like]: `%${cleanUser}%` } }
                ]
            };
        }
        const plans = await SitePlan.findAll({
            where: whereClause,
            order: [['date', 'DESC'], ['createdAt', 'DESC']]
        });
        res.json({ success: true, data: plans });
    } catch (err) {
        console.error('getAllSitePlans error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch site plans.' });
    }
};

// POST create site plan
exports.createSitePlan = async (req, res) => {
    try {
        const { date, time, clientName, engineerName, description, assignedBy, opportunityId } = req.body;
        if (!date) return res.status(400).json({ success: false, message: 'Date is required.' });
        const plan = await SitePlan.create({ date, time: time || '10:00', clientName, engineerName, description, assignedBy, opportunityId });
        res.json({ success: true, data: plan });
    } catch (err) {
        console.error('createSitePlan error:', err);
        res.status(500).json({ success: false, message: 'Failed to create site plan.' });
    }
};

// PUT update site plan
exports.updateSitePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time, engineerName, description } = req.body;
        const plan = await SitePlan.findByPk(id);
        if (!plan) return res.status(404).json({ success: false, message: 'Site plan not found.' });
        await plan.update({ 
            ...(date ? { date } : {}),
            ...(time ? { time } : {}),
            ...(engineerName !== undefined ? { engineerName } : {}),
            ...(description !== undefined ? { description } : {})
        });
        res.json({ success: true, data: plan });
    } catch (err) {
        console.error('updateSitePlan error:', err);
        res.status(500).json({ success: false, message: 'Failed to update site plan.' });
    }
};

// DELETE site plan
exports.deleteSitePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await SitePlan.findByPk(id);
        if (!plan) return res.status(404).json({ success: false, message: 'Site plan not found.' });
        await plan.destroy();
        res.json({ success: true, message: 'Site plan deleted.' });
    } catch (err) {
        console.error('deleteSitePlan error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete site plan.' });
    }
};
