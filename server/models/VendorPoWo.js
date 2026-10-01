const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const VendorPoWo = conDb.define('VendorPoWo', {
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
    poWoNumber: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'po_wo_number'
    },
    orderValue: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'order_value'
    },
    materialDescription: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'material_description'
    },
    clientName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'client_name'
    },
    orderType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'P.O',
        field: 'order_type'
    },
    generatedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'generated_by'
    },
    billVoucherStatus: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Not Submitted',
        field: 'bill_voucher_status'
    },
    invoiceNo: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'invoice_no'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'remarks'
    }
}, {
    tableName: 'vendor_po_wos',
    timestamps: true,
    underscored: true
});

module.exports = { VendorPoWo };
