const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');
const { OfficeVendor } = require('./OfficeVendor');

const VendorMaterialRate = conDb.define('VendorMaterialRate', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    vendorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'vendor_id',
        references: {
            model: OfficeVendor,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    materialName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'material_name'
    },
    rate: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0.0,
        field: 'rate'
    }
}, {
    tableName: 'vendor_material_rates',
    timestamps: true,
    underscored: true
});

OfficeVendor.hasMany(VendorMaterialRate, { as: 'materialRateRecords', foreignKey: 'vendor_id', onDelete: 'CASCADE' });
VendorMaterialRate.belongsTo(OfficeVendor, { as: 'vendor', foreignKey: 'vendor_id' });

module.exports = { VendorMaterialRate };
