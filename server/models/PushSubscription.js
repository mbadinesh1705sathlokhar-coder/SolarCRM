const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const PushSubscriptionModel = conDb.define('PushSubscription', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'user_name'
    },
    endpoint: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    keys: {
        type: DataTypes.JSON,
        allowNull: false
    },
    deviceInfo: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'device_info'
    }
}, {
    tableName: 'user_push_subscriptions',
    timestamps: true
});

module.exports = { PushSubscriptionModel };
