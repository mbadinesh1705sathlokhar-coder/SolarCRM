const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const SitePlan = conDb.define('SitePlan', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    date: { type: DataTypes.DATEONLY, allowNull: false, field: 'date' },
    time: { type: DataTypes.STRING(20), allowNull: true, defaultValue: '10:00', field: 'time' },
    clientName: { type: DataTypes.STRING(255), allowNull: true, field: 'client_name' },
    engineerName: { type: DataTypes.STRING(100), allowNull: true, field: 'engineer_name' },
    description: { type: DataTypes.TEXT, allowNull: true, field: 'description' },
    assignedBy: { type: DataTypes.STRING(100), allowNull: true, field: 'assigned_by' },
    opportunityId: { type: DataTypes.INTEGER, allowNull: true, field: 'opportunity_id' },
    status: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'Scheduled', field: 'status' }
}, {
    tableName: 'site_plans',
    timestamps: true,
    underscored: true
});

module.exports = { SitePlan };
