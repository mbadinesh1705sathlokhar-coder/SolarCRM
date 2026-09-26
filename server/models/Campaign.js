const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const Campaign = conDb.define('Campaign', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    campaignDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'campaign_date'
    },
    campaignName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'campaign_name'
    },
    venue: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'venue'
    }
}, {
    tableName: 'campaigns',
    timestamps: true,
    underscored: true
});

const CampaignLead = conDb.define('CampaignLead', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    campaignId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'campaign_id'
    },
    leadDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'lead_date'
    },
    leadName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'lead_name'
    },
    leadContact: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'lead_contact'
    },
    leadEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'lead_email'
    },
    leadLocation: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'lead_location'
    },
    leadStatus: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'On hold',
        field: 'lead_status'
    },
    leadHandler: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'Renuka',
        field: 'lead_handler'
    },
    leadRemarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'lead_remarks'
    }
}, {
    tableName: 'campaign_leads',
    timestamps: true,
    underscored: true
});

const CampaignExpense = conDb.define('CampaignExpense', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    campaignId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'campaign_id'
    },
    expenseDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'expense_date'
    },
    amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'amount'
    },
    purpose: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'purpose'
    },
    paidBy: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'OFFICE',
        field: 'paid_by'
    }
}, {
    tableName: 'campaign_expenses',
    timestamps: true,
    underscored: true
});

// Associations
Campaign.hasMany(CampaignLead, { foreignKey: 'campaignId', as: 'leads', onDelete: 'CASCADE' });
CampaignLead.belongsTo(Campaign, { foreignKey: 'campaignId' });

Campaign.hasMany(CampaignExpense, { foreignKey: 'campaignId', as: 'expenses', onDelete: 'CASCADE' });
CampaignExpense.belongsTo(Campaign, { foreignKey: 'campaignId' });

module.exports = { Campaign, CampaignLead, CampaignExpense };
