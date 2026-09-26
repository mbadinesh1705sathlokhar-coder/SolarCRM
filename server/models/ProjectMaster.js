const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const ProjectMaster = conDb.define('ProjectMaster', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    awardedDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'awarded_date'
    },
    siteId: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        field: 'site_id'
    },
    clientName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'client_name'
    },
    location: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    contactNo: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'contact_no'
    },
    emailId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'email_id'
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    siteCapacity: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'site_capacity'
    },
    siteValue: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'site_value'
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
    clientType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Individual',
        field: 'client_type'
    },
    saleType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'sale_type'
    },
    orderBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'order_by'
    },
    leadBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'lead_by'
    },
    received: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    siteExpenses: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'site_expenses'
    },
    materialsSupply: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'materials_supply'
    },
    installation: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    ebProcess: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'eb_process'
    },
    documents: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    warranty: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    handedOver: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'handed_over'
    },
    orderIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'order_index'
    }
}, {
    tableName: 'project_masters',
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Helper calculation methods
function computeMetrics(project) {
    const siteVal = parseFloat(project.siteValue) || 0;
    const recv = parseFloat(project.received) || 0;
    const exp = parseFloat(project.siteExpenses) || 0;

    const due = siteVal - recv;
    const margin = siteVal - exp;
    const marginPercentage = siteVal > 0 ? parseFloat(((margin / siteVal) * 100).toFixed(2)) : 0;

    // Checkbox milestones (6 items)
    const ticks = [
        Boolean(project.materialsSupply),
        Boolean(project.installation),
        Boolean(project.ebProcess),
        Boolean(project.documents),
        Boolean(project.warranty),
        Boolean(project.handedOver)
    ];
    const checkedCount = ticks.filter(Boolean).length;
    
    // Exact percentage map matching the user spreadsheet
    const milestonePercentages = {
        0: { completed: 0, wip: 100 },
        1: { completed: 17, wip: 83 },
        2: { completed: 33, wip: 67 },
        3: { completed: 50, wip: 50 },
        4: { completed: 67, wip: 33 },
        5: { completed: 83, wip: 17 },
        6: { completed: 100, wip: 0 }
    };
    const progress = milestonePercentages[checkedCount] || { completed: 0, wip: 100 };

    return {
        due: parseFloat(due.toFixed(2)),
        margin: parseFloat(margin.toFixed(2)),
        marginPercentage: parseFloat(marginPercentage),
        completedPercentage: progress.completed,
        workInProgressPercentage: progress.wip,
        checkedCount
    };
}

module.exports = { ProjectMaster, computeMetrics };
