const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const OfficeVendor = conDb.define('OfficeVendor', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    vendorName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'vendor_name'
    },
    salesCoordinator: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'sales_coordinator'
    },
    phoneNo: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'phone_no'
    },
    location: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'location'
    },
    materialsSpec: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'materials_spec'
    },
    creditDays: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'credit_days'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'description'
    }
}, {
    tableName: 'office_vendors',
    timestamps: true,
    underscored: true
});

module.exports = { OfficeVendor };
