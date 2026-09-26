const { Campaign, CampaignLead, CampaignExpense } = require('../models/Campaign');
const { SalesLead } = require('../models/SalesLead');

// Auto-transfer qualified campaign lead to main sales leads table
async function transferToSalesLead(campaignLead) {
    try {
        if (!campaignLead || !campaignLead.leadName) return { transferred: false };

        const trimmedName = campaignLead.leadName.trim();

        // Check if lead already exists in sales_leads by name
        const existing = await SalesLead.findOne({
            where: { leadName: trimmedName }
        });

        if (existing) {
            // If already exists, update handler and details to keep synchronized
            await existing.update({
                leadContact: campaignLead.leadContact ? campaignLead.leadContact.trim() : existing.leadContact,
                leadEmail: campaignLead.leadEmail ? campaignLead.leadEmail.trim() : existing.leadEmail,
                leadLocation: campaignLead.leadLocation ? campaignLead.leadLocation.trim() : existing.leadLocation,
                leadHandler: campaignLead.leadHandler || existing.leadHandler,
                leadRemarks: campaignLead.leadRemarks ? campaignLead.leadRemarks.trim() : existing.leadRemarks
            });
            return { transferred: true, lead: existing, wasExisting: true };
        }

        // Generate next auto-incremented leadId
        const lastLead = await SalesLead.findOne({ order: [['id', 'DESC']] });
        let nextNum = 101;
        if (lastLead && lastLead.leadId) {
            const match = lastLead.leadId.match(/(\d+)/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
        }
        const leadId = `SLD-${nextNum}`;

        const createdSalesLead = await SalesLead.create({
            leadId,
            leadDate: campaignLead.leadDate || new Date().toISOString().substring(0, 10),
            leadName: trimmedName,
            leadContact: campaignLead.leadContact ? campaignLead.leadContact.trim() : '',
            leadEmail: campaignLead.leadEmail ? campaignLead.leadEmail.trim() : '',
            leadLocation: campaignLead.leadLocation ? campaignLead.leadLocation.trim() : '',
            leadStatus: 'New', // Per requirement: "making the status to new"
            leadHandler: campaignLead.leadHandler || 'Renuka', // Per requirement: "and the Lead Handler as it is"
            leadRemarks: campaignLead.leadRemarks ? campaignLead.leadRemarks.trim() : ''
        });

        return { transferred: true, lead: createdSalesLead, wasExisting: false };
    } catch (err) {
        console.error('Error transferring campaign lead to sales lead:', err);
        return { transferred: false, error: err.message };
    }
}

// Get all campaigns with aggregated lead/expense counts
async function getAllCampaigns(req, res) {
    try {
        const campaigns = await Campaign.findAll({
            include: [
                { model: CampaignLead, as: 'leads' },
                { model: CampaignExpense, as: 'expenses' }
            ],
            order: [['campaignDate', 'DESC']]
        });

        const formatted = campaigns.map(c => {
            const plain = c.get({ plain: true });
            const leads = plain.leads || [];
            const expenses = plain.expenses || [];
            const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
            return {
                ...plain,
                leadCount: leads.length,
                expenseCount: expenses.length,
                totalExpenses
            };
        });

        res.json({ success: true, data: formatted });
    } catch (err) {
        console.error('Error fetching campaigns:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
    }
}

// Create campaign
async function createCampaign(req, res) {
    try {
        const { campaignDate, campaignName, venue } = req.body;
        if (!campaignName || !venue) {
            return res.status(400).json({ success: false, message: 'Campaign name and venue are required.' });
        }
        const created = await Campaign.create({
            campaignDate: campaignDate || new Date(),
            campaignName,
            venue
        });
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        console.error('Error creating campaign:', err);
        res.status(500).json({ success: false, message: 'Failed to create campaign' });
    }
}

// Update campaign
async function updateCampaign(req, res) {
    try {
        const { id } = req.params;
        const { campaignDate, campaignName, venue } = req.body;
        const campaign = await Campaign.findByPk(id);
        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }
        await campaign.update({
            campaignDate: campaignDate || campaign.campaignDate,
            campaignName: campaignName !== undefined ? campaignName : campaign.campaignName,
            venue: venue !== undefined ? venue : campaign.venue
        });
        res.json({ success: true, data: campaign });
    } catch (err) {
        console.error('Error updating campaign:', err);
        res.status(500).json({ success: false, message: 'Failed to update campaign' });
    }
}

// Delete campaign
async function deleteCampaign(req, res) {
    try {
        const { id } = req.params;
        const campaign = await Campaign.findByPk(id);
        if (!campaign) {
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        }
        await campaign.destroy();
        res.json({ success: true, message: 'Campaign deleted successfully' });
    } catch (err) {
        console.error('Error deleting campaign:', err);
        res.status(500).json({ success: false, message: 'Failed to delete campaign' });
    }
}

// --- CAMPAIGN LEADS ---
async function getCampaignLeads(req, res) {
    try {
        const { campaignId } = req.params;
        const leads = await CampaignLead.findAll({
            where: { campaignId },
            order: [['leadDate', 'DESC']]
        });
        res.json({ success: true, data: leads });
    } catch (err) {
        console.error('Error fetching campaign leads:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch campaign leads' });
    }
}

async function createCampaignLead(req, res) {
    try {
        const { campaignId } = req.params;
        const { leadDate, leadName, leadContact, leadEmail, leadLocation, leadStatus, leadHandler, leadRemarks } = req.body;
        if (!leadName) {
            return res.status(400).json({ success: false, message: 'Lead name is required.' });
        }
        const created = await CampaignLead.create({
            campaignId,
            leadDate: leadDate || new Date(),
            leadName,
            leadContact: leadContact || '',
            leadEmail: leadEmail || '',
            leadLocation: leadLocation || '',
            leadStatus: leadStatus || 'On hold',
            leadHandler: leadHandler || 'Renuka',
            leadRemarks: leadRemarks || ''
        });

        // Automatically transfer client details from Campaign to Sales Leads (status: 'New')
        // The record also remains on the campaign to keep track of expo interactions
        const transferResult = await transferToSalesLead(created);

        res.status(201).json({
            success: true,
            data: created,
            transferredToSales: !!transferResult?.transferred,
            salesLead: transferResult?.lead,
            wasExisting: transferResult?.wasExisting
        });
    } catch (err) {
        console.error('Error creating campaign lead:', err);
        res.status(500).json({ success: false, message: 'Failed to create campaign lead' });
    }
}

async function updateCampaignLead(req, res) {
    try {
        const { id } = req.params;
        const lead = await CampaignLead.findByPk(id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        await lead.update(req.body);

        // Keep client details synced with Sales Leads
        const transferResult = await transferToSalesLead(lead);


        res.json({
            success: true,
            data: lead,
            transferredToSales: !!transferResult?.transferred,
            salesLead: transferResult?.lead,
            wasExisting: transferResult?.wasExisting
        });
    } catch (err) {
        console.error('Error updating campaign lead:', err);
        res.status(500).json({ success: false, message: 'Failed to update campaign lead' });
    }
}

async function deleteCampaignLead(req, res) {
    try {
        const { id } = req.params;
        const lead = await CampaignLead.findByPk(id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        await lead.destroy();
        res.json({ success: true, message: 'Campaign lead deleted' });
    } catch (err) {
        console.error('Error deleting campaign lead:', err);
        res.status(500).json({ success: false, message: 'Failed to delete campaign lead' });
    }
}

// --- CAMPAIGN EXPENSES ---
async function getAllCampaignExpenses(req, res) {
    try {
        const expenses = await CampaignExpense.findAll({
            include: [{
                model: Campaign,
                attributes: ['id', 'campaignName', 'venue', 'campaignDate']
            }],
            order: [['expenseDate', 'DESC']]
        });
        const formatted = expenses.map(e => {
            const plain = e.get({ plain: true });
            return {
                id: plain.id,
                campaignId: plain.campaignId,
                campaignName: plain.Campaign ? plain.Campaign.campaignName : 'Expo',
                venue: plain.Campaign ? plain.Campaign.venue : '',
                expenseDate: plain.expenseDate,
                amount: parseFloat(plain.amount || 0),
                purpose: plain.purpose,
                paidBy: plain.paidBy || 'OFFICE',
                createdAt: plain.createdAt,
                updatedAt: plain.updatedAt
            };
        });
        res.json({ success: true, data: formatted });
    } catch (err) {
        console.error('Error fetching all campaign expenses:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch all campaign expenses' });
    }
}

async function getCampaignExpenses(req, res) {
    try {
        const { campaignId } = req.params;
        const expenses = await CampaignExpense.findAll({
            where: { campaignId },
            order: [['expenseDate', 'DESC']]
        });
        res.json({ success: true, data: expenses });
    } catch (err) {
        console.error('Error fetching campaign expenses:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch campaign expenses' });
    }
}

async function createCampaignExpense(req, res) {
    try {
        const { campaignId } = req.params;
        const { expenseDate, amount, purpose, paidBy } = req.body;
        if (!purpose) {
            return res.status(400).json({ success: false, message: 'Expense purpose is required.' });
        }
        const created = await CampaignExpense.create({
            campaignId,
            expenseDate: expenseDate || new Date(),
            amount: parseFloat(amount) || 0,
            purpose,
            paidBy: paidBy || 'OFFICE'
        });
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        console.error('Error creating campaign expense:', err);
        res.status(500).json({ success: false, message: 'Failed to create campaign expense' });
    }
}

async function createExpoExpense(req, res) {
    try {
        let { campaignId, campaignName, expenseDate, amount, purpose, paidBy } = req.body;
        if (!purpose) {
            return res.status(400).json({ success: false, message: 'Expense description/purpose is required.' });
        }
        if (!campaignId && campaignName) {
            let found = await Campaign.findOne({ where: { campaignName: campaignName.trim() } });
            if (!found) {
                found = await Campaign.create({
                    campaignName: campaignName.trim(),
                    venue: 'Expo Venue',
                    campaignDate: expenseDate || new Date()
                });
            }
            campaignId = found.id;
        }
        if (!campaignId) {
            const firstCamp = await Campaign.findOne();
            if (firstCamp) campaignId = firstCamp.id;
            else {
                const newCamp = await Campaign.create({ campaignName: 'General Expo', venue: 'Chennai', campaignDate: expenseDate || new Date() });
                campaignId = newCamp.id;
            }
        }
        const created = await CampaignExpense.create({
            campaignId,
            expenseDate: expenseDate || new Date(),
            amount: parseFloat(amount) || 0,
            purpose,
            paidBy: paidBy || 'OFFICE'
        });
        const full = await CampaignExpense.findByPk(created.id, {
            include: [{ model: Campaign, attributes: ['id', 'campaignName', 'venue'] }]
        });
        const plain = full.get({ plain: true });
        res.status(201).json({
            success: true,
            data: {
                id: plain.id,
                campaignId: plain.campaignId,
                campaignName: plain.Campaign ? plain.Campaign.campaignName : 'Expo',
                venue: plain.Campaign ? plain.Campaign.venue : '',
                expenseDate: plain.expenseDate,
                amount: parseFloat(plain.amount || 0),
                purpose: plain.purpose,
                paidBy: plain.paidBy || 'OFFICE',
                createdAt: plain.createdAt,
                updatedAt: plain.updatedAt
            }
        });
    } catch (err) {
        console.error('Error creating expo expense:', err);
        res.status(500).json({ success: false, message: 'Failed to create expo expense' });
    }
}

async function updateCampaignExpense(req, res) {
    try {
        const { id } = req.params;
        const expense = await CampaignExpense.findByPk(id);
        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }
        await expense.update(req.body);
        res.json({ success: true, data: expense });
    } catch (err) {
        console.error('Error updating campaign expense:', err);
        res.status(500).json({ success: false, message: 'Failed to update campaign expense' });
    }
}

async function deleteCampaignExpense(req, res) {
    try {
        const { id } = req.params;
        const expense = await CampaignExpense.findByPk(id);
        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }
        await expense.destroy();
        res.json({ success: true, message: 'Campaign expense deleted' });
    } catch (err) {
        console.error('Error deleting campaign expense:', err);
        res.status(500).json({ success: false, message: 'Failed to delete campaign expense' });
    }
}

// Seed campaigns if empty
async function seedCampaignsIfEmpty() {
    try {
        // Dummy campaigns seeding disabled per requirement: real world data to be entered
        // No automatic insertion of dummy records
    } catch (err) {
        console.error('Error seeding campaigns:', err);
    }
}

module.exports = {
    getAllCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaignLeads,
    createCampaignLead,
    updateCampaignLead,
    deleteCampaignLead,
    getAllCampaignExpenses,
    getCampaignExpenses,
    createCampaignExpense,
    createExpoExpense,
    updateCampaignExpense,
    deleteCampaignExpense,
    seedCampaignsIfEmpty
};
