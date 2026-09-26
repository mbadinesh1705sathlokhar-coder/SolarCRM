const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

// 1. Meeting Model
const Meeting = conDb.define('Meeting', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    purpose: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Client'
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    clientName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'client_name'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    time: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    engineer: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    coordinator: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Renuka'
    },
    location: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Scheduled'
    }
}, {
    tableName: 'contact_meetings',
    timestamps: true
});

// 2. Call Log Model
const CallLog = conDb.define('CallLog', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    time: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    clientVendorName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'client_vendor_name'
    },
    status: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'New Lead'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    callerName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Renuka',
        field: 'caller_name'
    },
    phoneNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'phone_number'
    }
}, {
    tableName: 'contact_call_logs',
    timestamps: true
});

// 3. Task Model
const TaskItem = conDb.define('TaskItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    taskId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'task_id'
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    assignedFrom: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Dinesh Kumar',
        field: 'assigned_from'
    },
    assignedTo: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'assigned_to'
    },
    dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: DataTypes.NOW,
        field: 'due_date'
    },
    time: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: '10:00 AM'
    },
    priority: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'Medium'
    },
    status: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'Pending'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    relatedTo: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'related_to'
    }
}, {
    tableName: 'contact_tasks',
    timestamps: true
});

module.exports = {
    Meeting,
    CallLog,
    TaskItem
};
