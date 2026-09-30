const { SalesLead } = require('../models/SalesLead');
const { Op } = require('sequelize');

/**
 * Get all sales leads with optional filters
 */
exports.getAllLeads = async (req, res) => {
    try {
        const { status, handler, search } = req.query;
        const whereClause = {};

        if (status) {
            whereClause.leadStatus = status;
        }

        if (handler) {
            whereClause.leadHandler = handler;
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            whereClause[Op.or] = [
                { leadId: { [Op.like]: term } },
                { leadName: { [Op.like]: term } },
                { leadLocation: { [Op.like]: term } },
                { leadContact: { [Op.like]: term } },
                { leadEmail: { [Op.like]: term } },
                { leadHandler: { [Op.like]: term } },
                { leadStatus: { [Op.like]: term } }
            ];
        }

        const leads = await SalesLead.findAll({
            where: whereClause,
            order: [['id', 'DESC']]
        });

        res.json({
            success: true,
            count: leads.length,
            data: leads
        });
    } catch (err) {
        console.error('Error fetching sales leads:', err);
        res.status(500).json({ success: false, message: 'Server error retrieving sales leads', error: err.message });
    }
};

/**
 * Get Opportunities (leads with leadStatus = 'Oppurtunity')
 */
exports.getOpportunities = async (req, res) => {
    try {
        const { handler, search } = req.query;
        const whereClause = {
            leadStatus: { [Op.in]: [
                'Qualify', 'Oppurtunity', 'Opportunity',
                'Site Visit Planned', 'Site Visit Completed',
                'Offer Letter Submitted', 'Negotiation',
                'Order Won', 'Order Lost', 'Order Postponed'
            ] }
        };

        if (handler) {
            whereClause.leadHandler = handler;
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            whereClause[Op.or] = [
                { leadId: { [Op.like]: term } },
                { leadName: { [Op.like]: term } },
                { leadLocation: { [Op.like]: term } },
                { leadContact: { [Op.like]: term } },
                { leadEmail: { [Op.like]: term } },
                { leadHandler: { [Op.like]: term } }
            ];
        }

        const opportunities = await SalesLead.findAll({
            where: whereClause,
            order: [['id', 'DESC']]
        });

        res.json({
            success: true,
            count: opportunities.length,
            data: opportunities
        });
    } catch (err) {
        console.error('Error fetching opportunities:', err);
        res.status(500).json({ success: false, message: 'Server error retrieving opportunities', error: err.message });
    }
};

/**
 * Get next auto-incremented Lead ID suggestion
 */
exports.getNextLeadId = async (req, res) => {
    try {
        const lastLead = await SalesLead.findOne({
            order: [['id', 'DESC']]
        });

        let nextNumber = 101;
        if (lastLead && lastLead.leadId) {
            const match = lastLead.leadId.match(/(\d+)/);
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }

        const nextId = `SLD-${nextNumber}`;
        res.json({ success: true, nextLeadId: nextId });
    } catch (err) {
        console.error('Error getting next lead ID:', err);
        res.json({ success: true, nextLeadId: 'SLD-101' });
    }
};

/**
 * Create a new Sales Lead
 */
exports.createLead = async (req, res) => {
    try {
        let {
            leadId,
            leadDate,
            leadName,
            leadContact,
            leadEmail,
            leadLocation,
            leadStatus,
            leadHandler,
            leadRemarks,
            siteType,
            systemType,
            siteCategory,
            saleType,
            clientType
        } = req.body;

        if (!leadName || !leadName.trim()) {
            return res.status(400).json({ success: false, message: 'Lead Name is required' });
        }

        // Auto-generate leadId if not provided
        if (!leadId || !leadId.trim()) {
            const lastLead = await SalesLead.findOne({ order: [['id', 'DESC']] });
            let nextNum = 101;
            if (lastLead && lastLead.leadId) {
                const match = lastLead.leadId.match(/(\d+)/);
                if (match) nextNum = parseInt(match[1], 10) + 1;
            }
            leadId = `SLD-${nextNum}`;
        }

        const newLead = await SalesLead.create({
            leadId: leadId.trim().toUpperCase(),
            leadDate: leadDate || new Date().toISOString().substring(0, 10),
            leadName: leadName.trim(),
            leadContact: leadContact ? leadContact.trim() : '',
            leadEmail: leadEmail ? leadEmail.trim() : '',
            leadLocation: leadLocation ? leadLocation.trim() : '',
            leadStatus: leadStatus || 'New',
            leadHandler: leadHandler || 'Renuka',
            leadRemarks: leadRemarks ? leadRemarks.trim() : '',
            siteType: siteType || 'Residential',
            systemType: systemType || 'Ongrid',
            siteCategory: siteCategory || 'Rooftop',
            saleType: saleType || 'B2C',
            clientType: clientType || 'Individual'
        });

        res.status(201).json({
            success: true,
            message: 'Sales lead created successfully',
            data: newLead
        });
    } catch (err) {
        console.error('Error creating sales lead:', err);
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ success: false, message: 'Lead ID already exists. Please choose a unique Lead ID.' });
        }
        res.status(500).json({ success: false, message: 'Failed to create sales lead', error: err.message });
    }
};

/**
 * Update an existing Sales Lead
 */
exports.updateLead = async (req, res) => {
    try {
        const { id } = req.params;
        let lead = null;
        if (!isNaN(id) && Number.isInteger(Number(id))) {
            lead = await SalesLead.findByPk(id);
        }
        if (!lead) {
            lead = await SalesLead.findOne({ where: { leadId: id } });
        }

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Sales lead not found' });
        }

        const {
            leadId,
            leadDate,
            leadName,
            leadContact,
            leadEmail,
            leadLocation,
            leadStatus,
            leadHandler,
            leadRemarks,
            siteType,
            systemType,
            siteCategory,
            saleType,
            clientType
        } = req.body;

        // Order Won records are confirmed Awarded Sites and permanently locked from status changes
        if (lead.leadStatus === 'Order Won' && leadStatus && leadStatus !== 'Order Won') {
            return res.status(400).json({
                success: false,
                message: 'Order Won opportunities are confirmed Awarded Sites and are permanently locked from status changes.'
            });
        }

        await lead.update({
            leadId: leadId !== undefined ? leadId.trim().toUpperCase() : lead.leadId,
            leadDate: leadDate || lead.leadDate,
            leadName: leadName !== undefined ? leadName.trim() : lead.leadName,
            leadContact: leadContact !== undefined ? leadContact.trim() : lead.leadContact,
            leadEmail: leadEmail !== undefined ? leadEmail.trim() : lead.leadEmail,
            leadLocation: leadLocation !== undefined ? leadLocation.trim() : lead.leadLocation,
            leadStatus: leadStatus !== undefined ? leadStatus : lead.leadStatus,
            leadHandler: leadHandler !== undefined ? leadHandler : lead.leadHandler,
            leadRemarks: leadRemarks !== undefined ? leadRemarks.trim() : lead.leadRemarks,
            siteType: siteType !== undefined ? siteType : lead.siteType,
            systemType: systemType !== undefined ? systemType : lead.systemType,
            siteCategory: siteCategory !== undefined ? siteCategory : lead.siteCategory,
            saleType: saleType !== undefined ? saleType : lead.saleType,
            clientType: clientType !== undefined ? clientType : lead.clientType
        });

        res.json({
            success: true,
            message: 'Sales lead updated successfully',
            data: lead
        });
    } catch (err) {
        console.error('Error updating sales lead:', err);
        res.status(500).json({ success: false, message: 'Failed to update sales lead', error: err.message });
    }
};

/**
 * Delete a Sales Lead
 */
exports.deleteLead = async (req, res) => {
    try {
        const { id } = req.params;
        let lead = null;
        if (!isNaN(id) && Number.isInteger(Number(id))) {
            lead = await SalesLead.findByPk(id);
        }
        if (!lead) {
            lead = await SalesLead.findOne({ where: { leadId: id } });
        }

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Sales lead not found' });
        }

        if (lead.leadStatus === 'Order Won') {
            return res.status(400).json({
                success: false,
                message: 'Order Won opportunities are confirmed Awarded Sites and cannot be deleted.'
            });
        }

        await lead.destroy();
        res.json({ success: true, message: 'Sales lead deleted successfully' });
    } catch (err) {
        console.error('Error deleting sales lead:', err);
        res.status(500).json({ success: false, message: 'Failed to delete sales lead', error: err.message });
    }
};

/**
 * Seed initial sample leads if the table is empty
 */
exports.seedInitialLeadsIfEmpty = async () => {
    try {
        // Auto-normalize any previous status values in database to New, Qualify, Unqualify
        await SalesLead.update({ leadStatus: 'Qualify' }, { where: { leadStatus: 'Oppurtunity' } });
        await SalesLead.update({ leadStatus: 'Unqualify' }, { where: { leadStatus: ['unqualify', 'dead'] } });

        // Dummy leads seeding disabled per requirement: real world data to be entered
        // No automatic insertion of dummy records
    } catch (err) {
        console.error('Error seeding initial sales leads:', err);
    }
};
