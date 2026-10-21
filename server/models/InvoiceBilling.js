const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const InvoiceBilling = conDb.define('InvoiceBilling', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    invoiceDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'invoice_date'
    },
    invoiceNo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'invoice_no'
    },
    invoiceValue: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0.0,
        field: 'invoice_value'
    },
    clientName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'client_name'
    },
    invoiceType: {
        type: DataTypes.ENUM('Material Supply', 'I&C Work'),
        allowNull: false,
        defaultValue: 'Material Supply',
        field: 'invoice_type'
    },
    billTo: {
        type: DataTypes.STRING(200),
        allowNull: true,
        defaultValue: '',
        field: 'bill_to'
    },
    siteId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'site_id'
    },
    approvalStatus: {
        type: DataTypes.STRING(30),
        allowNull: true,
        defaultValue: 'Pending Approval',
        field: 'approval_status'
    },
    invoiceDocJson: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        field: 'invoice_doc_json'
    }
}, {
    tableName: 'invoice_billings',
    timestamps: true,
    underscored: true
});

module.exports = { InvoiceBilling };
