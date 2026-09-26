const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const Employee = conDb.define('Employee', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'name'
    },
    designation: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'designation'
    },
    phoneNo: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'phone_no'
    },
    emailId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'email_id'
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'address'
    },
    experience: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'experience'
    },
    username: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'username'
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'password'
    },
    role: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'employee',
        field: 'role'
    },
    photo: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        field: 'photo'
    },
    responsibility: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Sales',
        field: 'responsibility'
    },
    accessPermissions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: { canView: true, canAdd: true, canEdit: true, canDelete: false },
        field: 'access_permissions'
    }
}, {
    tableName: 'office_employees',
    timestamps: true,
    underscored: true
});

module.exports = { Employee };
