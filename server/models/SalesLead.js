const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const SalesLead = conDb.define('SalesLead', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    leadId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        field: 'lead_id'
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
        defaultValue: 'New',
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
    },
    siteType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Residential',
        field: 'site_type'
    },
    systemType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Ongrid',
        field: 'system_type'
    },
    siteCategory: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'TATA SPG',
        field: 'site_category'
    },
    saleType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'B2C',
        field: 'sale_type'
    },
    clientType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Individual',
        field: 'client_type'
    }
}, {
    tableName: 'sales_leads',
    timestamps: true,
    underscored: true
});

module.exports = { SalesLead };
