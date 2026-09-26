const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const VendorPayment = conDb.define('VendorPayment', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    vendorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'vendor_id'
    },
    vendorName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'vendor_name'
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'date'
    },
    amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'amount'
    },
    urnNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'urn_number'
    },
    paymentMode: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Bank Transfer / NEFT',
        field: 'payment_mode'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'remarks'
    }
}, {
    tableName: 'vendor_payments',
    timestamps: true,
    underscored: true
});

module.exports = { VendorPayment };
