const { Indent, IndentMaterial, WarehouseMaterial, GatePass, GatePassItem, CartItem } = require('../models/Inventory');

// ==========================================
// 1. INDENT CONTROLLER
// ==========================================
async function getAllIndents(req, res) {
    try {
        const indents = await Indent.findAll({
            include: [{ model: IndentMaterial, as: 'materials' }],
            order: [['indentDate', 'DESC'], ['id', 'DESC']]
        });
        res.json({ success: true, data: indents });
    } catch (err) {
        console.error('Error fetching indents:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch indents' });
    }
}

async function getIndentById(req, res) {
    try {
        const { id } = req.params;
        const indent = await Indent.findByPk(id, {
            include: [{ model: IndentMaterial, as: 'materials' }]
        });
        if (!indent) {
            return res.status(404).json({ success: false, message: 'Indent not found' });
        }
        res.json({ success: true, data: indent });
    } catch (err) {
        console.error('Error fetching indent:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch indent' });
    }
}

async function createIndent(req, res) {
    try {
        let { indentDate, indentNo, siteEngineer, clientName, materials } = req.body;
        if (!clientName || !clientName.trim()) {
            return res.status(400).json({ success: false, message: 'Client name is required.' });
        }

        // Auto-generate indentNo if empty
        if (!indentNo || !indentNo.trim()) {
            const last = await Indent.findOne({ order: [['id', 'DESC']] });
            let nextNum = 101;
            if (last && last.indentNo) {
                const match = last.indentNo.match(/(\d+)/);
                if (match) nextNum = parseInt(match[1], 10) + 1;
            }
            indentNo = `IND-${nextNum}`;
        }

        const createdIndent = await Indent.create({
            indentDate: indentDate || new Date().toISOString().substring(0, 10),
            indentNo: indentNo.trim().toUpperCase(),
            siteEngineer: siteEngineer || 'Dinesh Kumar',
            clientName: clientName.trim()
        });

        // Insert nested requested materials
        if (Array.isArray(materials) && materials.length > 0) {
            const matRecords = materials.map(m => ({
                indentId: createdIndent.id,
                materialName: m.materialName || 'Solar Component',
                quantity: parseFloat(m.quantity) || 1,
                unit: m.unit || 'Nos',
                status: m.status || 'Ready to issue',
                poWo: !!m.poWo
            }));
            await IndentMaterial.bulkCreate(matRecords);
        }

        const full = await Indent.findByPk(createdIndent.id, {
            include: [{ model: IndentMaterial, as: 'materials' }]
        });

        res.status(201).json({ success: true, data: full });
    } catch (err) {
        console.error('Error creating indent:', err);
        res.status(500).json({ success: false, message: 'Failed to create indent', error: err.message });
    }
}

async function updateIndent(req, res) {
    try {
        const { id } = req.params;
        const { indentDate, indentNo, siteEngineer, clientName, materials } = req.body;

        const indent = await Indent.findByPk(id);
        if (!indent) {
            return res.status(404).json({ success: false, message: 'Indent not found' });
        }

        await indent.update({
            indentDate: indentDate || indent.indentDate,
            indentNo: indentNo !== undefined ? indentNo.trim() : indent.indentNo,
            siteEngineer: siteEngineer !== undefined ? siteEngineer : indent.siteEngineer,
            clientName: clientName !== undefined ? clientName.trim() : indent.clientName
        });

        // Replace materials if provided
        if (Array.isArray(materials)) {
            await IndentMaterial.destroy({ where: { indentId: id } });
            if (materials.length > 0) {
                const matRecords = materials.map(m => ({
                    indentId: id,
                    materialName: m.materialName || 'Solar Component',
                    quantity: parseFloat(m.quantity) || 1,
                    unit: m.unit || 'Nos',
                    status: m.status || 'Ready to issue',
                    poWo: !!m.poWo
                }));
                await IndentMaterial.bulkCreate(matRecords);
            }
        }

        const full = await Indent.findByPk(id, {
            include: [{ model: IndentMaterial, as: 'materials' }]
        });

        res.json({ success: true, data: full });
    } catch (err) {
        console.error('Error updating indent:', err);
        res.status(500).json({ success: false, message: 'Failed to update indent', error: err.message });
    }
}

async function deleteIndent(req, res) {
    try {
        const { id } = req.params;
        const indent = await Indent.findByPk(id);
        if (!indent) {
            return res.status(404).json({ success: false, message: 'Indent not found' });
        }
        await indent.destroy();
        res.json({ success: true, message: 'Indent deleted successfully' });
    } catch (err) {
        console.error('Error deleting indent:', err);
        res.status(500).json({ success: false, message: 'Failed to delete indent' });
    }
}

// ==========================================
// 2. WAREHOUSE MATERIALS CONTROLLER
// ==========================================
async function getAllWarehouseMaterials(req, res) {
    try {
        const items = await WarehouseMaterial.findAll({
            order: [['materialName', 'ASC']]
        });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error('Error fetching warehouse materials:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch warehouse materials' });
    }
}

async function createWarehouseMaterial(req, res) {
    try {
        const { materialName, description, unit, inStock, status } = req.body;
        if (!materialName || !materialName.trim()) {
            return res.status(400).json({ success: false, message: 'Material name is required.' });
        }

        const created = await WarehouseMaterial.create({
            materialName: materialName.trim(),
            description: description ? description.trim() : '',
            unit: unit || 'Nos',
            inStock: parseFloat(inStock) || 0,
            status: status || (parseFloat(inStock) > 0 ? 'In Stock' : 'Out of Stock')
        });

        res.status(201).json({ success: true, data: created });
    } catch (err) {
        console.error('Error creating warehouse material:', err);
        res.status(500).json({ success: false, message: 'Failed to create warehouse material' });
    }
}

async function updateWarehouseMaterial(req, res) {
    try {
        const { id } = req.params;
        const item = await WarehouseMaterial.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Material not found' });
        }

        await item.update(req.body);
        res.json({ success: true, data: item });
    } catch (err) {
        console.error('Error updating warehouse material:', err);
        res.status(500).json({ success: false, message: 'Failed to update warehouse material' });
    }
}

async function deleteWarehouseMaterial(req, res) {
    try {
        const { id } = req.params;
        const item = await WarehouseMaterial.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Material not found' });
        }

        await item.destroy();
        res.json({ success: true, message: 'Warehouse material deleted' });
    } catch (err) {
        console.error('Error deleting warehouse material:', err);
        res.status(500).json({ success: false, message: 'Failed to delete warehouse material' });
    }
}

// ==========================================
// 3. GATE PASS CONTROLLER
// ==========================================
async function getAllGatePasses(req, res) {
    try {
        const passes = await GatePass.findAll({
            include: [{ model: GatePassItem, as: 'items' }],
            order: [['gatePassDate', 'DESC'], ['id', 'DESC']]
        });
        res.json({ success: true, data: passes });
    } catch (err) {
        console.error('Error fetching gate passes:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch gate passes' });
    }
}

async function createGatePass(req, res) {
    try {
        let { gatePassDate, descriptions, unit, quantity, clientName, siteEngineer, remarks, items } = req.body;
        if (!clientName || !clientName.trim()) {
            return res.status(400).json({ success: false, message: 'Client name is required.' });
        }

        // Auto-compute descriptions, total quantity, and unit from multiple items if provided
        if (Array.isArray(items) && items.length > 0) {
            descriptions = items.map(m => m.materialName || 'Material').join(', ');
            quantity = items.reduce((sum, m) => sum + (parseFloat(m.quantity) || 0), 0);
            unit = items.length === 1 ? (items[0].unit || 'Nos') : `${items.length} Items`;
        }

        if (!descriptions || !descriptions.trim()) {
            return res.status(400).json({ success: false, message: 'Descriptions / Materials are required.' });
        }

        const created = await GatePass.create({
            gatePassDate: gatePassDate || new Date().toISOString().substring(0, 10),
            descriptions: descriptions.trim(),
            unit: unit || 'Nos',
            quantity: parseFloat(quantity) || 1,
            clientName: clientName.trim(),
            siteEngineer: siteEngineer || 'Dinesh Kumar',
            remarks: remarks ? remarks.trim() : ''
        });

        // Insert nested items if provided
        if (Array.isArray(items) && items.length > 0) {
            const itemRecords = items.map(m => ({
                gatePassId: created.id,
                materialName: m.materialName || 'Material',
                quantity: parseFloat(m.quantity) || 1,
                unit: m.unit || 'Nos'
            }));
            await GatePassItem.bulkCreate(itemRecords);
        }

        const full = await GatePass.findByPk(created.id, {
            include: [{ model: GatePassItem, as: 'items' }]
        });

        res.status(201).json({ success: true, data: full });
    } catch (err) {
        console.error('Error creating gate pass:', err);
        res.status(500).json({ success: false, message: 'Failed to create gate pass', error: err.message });
    }
}

async function updateGatePass(req, res) {
    try {
        const { id } = req.params;
        let { gatePassDate, descriptions, unit, quantity, clientName, siteEngineer, remarks, items } = req.body;
        const pass = await GatePass.findByPk(id);
        if (!pass) {
            return res.status(404).json({ success: false, message: 'Gate pass not found' });
        }

        // Auto-compute descriptions, total quantity, and unit from multiple items if provided
        if (Array.isArray(items) && items.length > 0) {
            descriptions = items.map(m => m.materialName || 'Material').join(', ');
            quantity = items.reduce((sum, m) => sum + (parseFloat(m.quantity) || 0), 0);
            unit = items.length === 1 ? (items[0].unit || 'Nos') : `${items.length} Items`;
        }

        await pass.update({
            gatePassDate: gatePassDate || pass.gatePassDate,
            descriptions: descriptions !== undefined ? descriptions.trim() : pass.descriptions,
            unit: unit !== undefined ? unit : pass.unit,
            quantity: quantity !== undefined ? parseFloat(quantity) || pass.quantity : pass.quantity,
            clientName: clientName !== undefined ? clientName.trim() : pass.clientName,
            siteEngineer: siteEngineer !== undefined ? siteEngineer : pass.siteEngineer,
            remarks: remarks !== undefined ? (remarks ? remarks.trim() : '') : pass.remarks
        });

        // Replace nested items if provided
        if (Array.isArray(items)) {
            await GatePassItem.destroy({ where: { gatePassId: id } });
            if (items.length > 0) {
                const itemRecords = items.map(m => ({
                    gatePassId: id,
                    materialName: m.materialName || 'Material',
                    quantity: parseFloat(m.quantity) || 1,
                    unit: m.unit || 'Nos'
                }));
                await GatePassItem.bulkCreate(itemRecords);
            }
        }

        const full = await GatePass.findByPk(id, {
            include: [{ model: GatePassItem, as: 'items' }]
        });

        res.json({ success: true, data: full });
    } catch (err) {
        console.error('Error updating gate pass:', err);
        res.status(500).json({ success: false, message: 'Failed to update gate pass', error: err.message });
    }
}

async function deleteGatePass(req, res) {
    try {
        const { id } = req.params;
        const pass = await GatePass.findByPk(id);
        if (!pass) {
            return res.status(404).json({ success: false, message: 'Gate pass not found' });
        }

        await pass.destroy();
        res.json({ success: true, message: 'Gate pass deleted' });
    } catch (err) {
        console.error('Error deleting gate pass:', err);
        res.status(500).json({ success: false, message: 'Failed to delete gate pass' });
    }
}

// ==========================================
// 4. CART ITEMS CONTROLLER (Screenshot 2)
// ==========================================
async function getCartItems(req, res) {
    try {
        const items = await CartItem.findAll({
            order: [['orderDate', 'DESC'], ['id', 'DESC']]
        });

        // Compute summary metrics for the Order Summary card
        const totalItems = items.length;
        const totalQuantity = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
        const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0);
        
        const siteSet = new Set(items.map(i => i.clientLocation).filter(Boolean));
        const vendorSet = new Set(items.map(i => i.vendorName).filter(Boolean));

        const statusCounts = {};
        items.forEach(i => {
            const st = i.procurementStatus || 'Yet to Start';
            statusCounts[st] = (statusCounts[st] || 0) + 1;
        });

        res.json({
            success: true,
            data: items,
            summary: {
                totalItems,
                totalQuantity,
                totalAmount,
                activeSitesCount: siteSet.size,
                assignedVendorsCount: vendorSet.size,
                statusCounts
            }
        });
    } catch (err) {
        console.error('Error fetching cart items:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch cart items' });
    }
}

async function createCartItem(req, res) {
    try {
        const { items, orderDate, vendorName, procurementStatus, material, clientLocation, quantity, unit, totalAmount } = req.body;

        // If multiple items are provided (batch creation)
        if (Array.isArray(items) && items.length > 0) {
            const validRows = items.filter(r => r.material && r.material.trim());
            if (validRows.length === 0) {
                return res.status(400).json({ success: false, message: 'At least one valid material item is required.' });
            }
            const toCreate = validRows.map(r => ({
                orderDate: r.orderDate || orderDate || new Date().toISOString().substring(0, 10),
                material: r.material.trim(),
                clientLocation: (r.clientLocation || clientLocation || '').trim(),
                quantity: parseFloat(r.quantity) || 1,
                unit: r.unit || 'Nos',
                vendorName: (r.vendorName !== undefined && r.vendorName !== '' ? r.vendorName : (vendorName || '')).trim(),
                procurementStatus: r.procurementStatus || procurementStatus || 'Yet to Start',
                totalAmount: parseFloat(r.totalAmount) || 0.00
            }));
            const createdItems = await CartItem.bulkCreate(toCreate);
            return res.status(201).json({ success: true, data: createdItems, count: createdItems.length });
        }

        // Single item fallback
        if (!material || !material.trim()) {
            return res.status(400).json({ success: false, message: 'Material is required.' });
        }

        const created = await CartItem.create({
            orderDate: orderDate || new Date().toISOString().substring(0, 10),
            material: material.trim(),
            clientLocation: (clientLocation || '').trim(),
            quantity: parseFloat(quantity) || 1,
            unit: unit || 'Nos',
            vendorName: vendorName ? vendorName.trim() : '',
            procurementStatus: procurementStatus || 'Yet to Start',
            totalAmount: parseFloat(totalAmount) || 0.00
        });

        res.status(201).json({ success: true, data: created });
    } catch (err) {
        console.error('Error creating cart item:', err);
        res.status(500).json({ success: false, message: 'Failed to create cart item' });
    }
}

async function updateCartItem(req, res) {
    try {
        const { id } = req.params;
        const item = await CartItem.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Cart item not found' });
        }

        await item.update(req.body);
        res.json({ success: true, data: item });
    } catch (err) {
        console.error('Error updating cart item:', err);
        res.status(500).json({ success: false, message: 'Failed to update cart item' });
    }
}

async function deleteCartItem(req, res) {
    try {
        const { id } = req.params;
        const item = await CartItem.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Cart item not found' });
        }

        await item.destroy();
        res.json({ success: true, message: 'Cart item deleted' });
    } catch (err) {
        console.error('Error deleting cart item:', err);
        res.status(500).json({ success: false, message: 'Failed to delete cart item' });
    }
}

// ==========================================
// 5. SEED DATA GENERATOR
// ==========================================
async function seedInventoryIfEmpty() {
    try {
        // Dummy inventory seeding disabled per user requirement: real world data to be entered
        return;
    } catch (err) {
        console.error('Error seeding Inventory module:', err);
    }
}

module.exports = {
    // Indent
    getAllIndents,
    getIndentById,
    createIndent,
    updateIndent,
    deleteIndent,
    // Warehouse
    getAllWarehouseMaterials,
    createWarehouseMaterial,
    updateWarehouseMaterial,
    deleteWarehouseMaterial,
    // Gate Pass
    getAllGatePasses,
    createGatePass,
    updateGatePass,
    deleteGatePass,
    // Cart
    getCartItems,
    createCartItem,
    updateCartItem,
    deleteCartItem,
    // Seed
    seedInventoryIfEmpty
};
