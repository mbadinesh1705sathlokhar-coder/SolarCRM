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
    gstNo: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'gst_no'
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
    },
    materialRates: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'material_rates'
    },
    accountNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'account_number'
    },
    ccAccNo: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'cc_acc_no'
    },
    bankName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'bank_name'
    },
    ifscCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'ifsc_code'
    },
    branch: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'branch'
    }
}, {
    tableName: 'office_vendors',
    timestamps: true,
    underscored: true
});

module.exports = { OfficeVendor };
