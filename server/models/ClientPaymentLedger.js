const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const ClientPaymentLedger = conDb.define('ClientPaymentLedger', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    sNo: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 's_no'
    },
    mop: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'mop'
    },
    clientSiteName: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'client_site_name'
    },
    siteId: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'site_id'
    },
    clientName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'client_name'
    },
    paymentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'payment_date'
    },
    amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    paymentMode: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Bank Transfer / NEFT',
        field: 'payment_mode'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    referenceNo: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'reference_no'
    }
}, {
    tableName: 'client_payment_ledgers',
    timestamps: true
});

module.exports = { ClientPaymentLedger };
