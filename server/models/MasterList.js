const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

const MasterList = conDb.define('MasterList', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        field: 'title'
    },
    category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'General',
        field: 'category'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'description'
    }
}, {
    tableName: 'master_lists',
    timestamps: true,
    underscored: true
});

const MasterListItem = conDb.define('MasterListItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    listId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'list_id',
        references: {
            model: MasterList,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    itemValue: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'item_value'
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'sort_order'
    }
}, {
    tableName: 'master_list_items',
    timestamps: true,
    underscored: true
});

// Associations
MasterList.hasMany(MasterListItem, { as: 'items', foreignKey: 'list_id', onDelete: 'CASCADE' });
MasterListItem.belongsTo(MasterList, { foreignKey: 'list_id' });

module.exports = {
    MasterList,
    MasterListItem
};
