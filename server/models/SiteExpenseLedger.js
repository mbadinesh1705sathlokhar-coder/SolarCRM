const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const SiteExpenseLedger = conDb.define('SiteExpenseLedger', {
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
    expenseDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'expense_date'
    },
    siteId: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'site_id'
    },
    clientSiteName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'client_site_name'
    },
    clientName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: '',
        field: 'client_name'
    },
    amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    paymentThrough: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'payment_through'
    },
    purpose: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'purpose'
    },
    paidBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'paid_by'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'remarks'
    },
    billVoucher: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'bill_voucher'
    },
    invoiceNo: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'invoice_no'
    },
    claimStatus: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'claim_status'
    },
    paymentNote: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'payment_note'
    },
    // Compatibility fields
    category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'category'
    },
    vendorName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'vendor_name'
    },
    referenceNo: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'reference_no'
    }
}, {
    tableName: 'site_expense_ledgers',
    timestamps: true
});

module.exports = { SiteExpenseLedger };
