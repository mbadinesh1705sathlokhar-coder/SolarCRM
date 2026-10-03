const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const BomMaterialMaster = conDb.define('BomMaterialMaster', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    groupName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'group_name'
    },
    categoryType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Standard',
        field: 'category_type'
    },
    specification: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'specification'
    },
    defaultUom: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'Meter',
        field: 'default_uom'
    },
    unitRate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'unit_rate'
    },
    gstPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 18.00,
        field: 'gst_percent'
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        field: 'sort_order'
    }
}, {
    tableName: 'bom_material_masters',
    timestamps: true,
    underscored: true
});

module.exports = { BomMaterialMaster };
