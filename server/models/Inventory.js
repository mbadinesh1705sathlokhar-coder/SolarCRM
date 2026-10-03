const { DataTypes } = require('sequelize');
const { conDb } = require('../database/database');

// 1. Indent Model
const Indent = conDb.define('Indent', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    indentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'indent_date'
    },
    indentNo: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        field: 'indent_no'
    },
    siteEngineer: {
        type: DataTypes.STRING(150),
        allowNull: false,
        defaultValue: 'Soundarajan',
        field: 'site_engineer'
    },
    clientName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'client_name'
    }
}, {
    tableName: 'inventory_indents',
    timestamps: true,
    underscored: true
});

// 2. Indent Material (Nested Requested Materials from Screenshot 1)
const IndentMaterial = conDb.define('IndentMaterial', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    indentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'indent_id',
        references: {
            model: Indent,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    materialName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'material_name'
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1.0,
        field: 'quantity'
    },
    unit: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Nos',
        field: 'unit'
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Ready to issue',
        field: 'status'
    },
    poWo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'po_wo'
    }
}, {
    tableName: 'inventory_indent_materials',
    timestamps: true,
    underscored: true
});

// Relationships
Indent.hasMany(IndentMaterial, { as: 'materials', foreignKey: 'indent_id', onDelete: 'CASCADE' });
IndentMaterial.belongsTo(Indent, { as: 'indent', foreignKey: 'indent_id' });

// 3. Warehouse Material Model
const WarehouseMaterial = conDb.define('WarehouseMaterial', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    materialName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'material_name'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'description'
    },
    unit: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Nos',
        field: 'unit'
    },
    inStock: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'in_stock'
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'In Stock',
        field: 'status'
    }
}, {
    tableName: 'inventory_warehouse_materials',
    timestamps: true,
    underscored: true
});

// 4. Gate Pass Model
const GatePass = conDb.define('GatePass', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    gatePassDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'gate_pass_date'
    },
    descriptions: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'descriptions'
    },
    unit: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Nos',
        field: 'unit'
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1.0,
        field: 'quantity'
    },
    clientName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'client_name'
    },
    siteEngineer: {
        type: DataTypes.STRING(150),
        allowNull: false,
        defaultValue: 'Soundarajan',
        field: 'site_engineer'
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'remarks'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'total_amount'
    },
    transportCost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'transport_cost'
    }
}, {
    tableName: 'inventory_gate_passes',
    timestamps: true,
    underscored: true
});

// 5. Gate Pass Item Model (Multiple materials per Gate Pass)
const GatePassItem = conDb.define('GatePassItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    gatePassId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'gate_pass_id',
        references: {
            model: GatePass,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    dispatchDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'dispatch_date'
    },
    materialName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'material_name'
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1.0,
        field: 'quantity'
    },
    unit: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Nos',
        field: 'unit'
    },
    rate: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'rate'
    },
    vendorName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: '',
        field: 'vendor_name'
    },
    amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'amount'
    }
}, {
    tableName: 'inventory_gate_pass_items',
    timestamps: true,
    underscored: true
});

// Relationships
GatePass.hasMany(GatePassItem, { as: 'items', foreignKey: 'gate_pass_id', onDelete: 'CASCADE' });
GatePassItem.belongsTo(GatePass, { as: 'gatePass', foreignKey: 'gate_pass_id' });

// 5. Cart Item Model (Add to Cart per Screenshot 2)
const CartItem = conDb.define('CartItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    orderDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'order_date'
    },
    material: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'material'
    },
    clientLocation: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: '',
        field: 'client_location'
    },
    quantity: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 1,
        field: 'quantity'
    },
    unit: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Nos',
        field: 'unit'
    },
    vendorName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'vendor_name'
    },
    procurementStatus: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'Yet to Start',
        field: 'procurement_status'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: true,
        defaultValue: 0.00,
        field: 'total_amount'
    }
}, {
    tableName: 'inventory_cart_items',
    timestamps: true,
    underscored: true
});

module.exports = {
    Indent,
    IndentMaterial,
    WarehouseMaterial,
    GatePass,
    GatePassItem,
    CartItem
};
