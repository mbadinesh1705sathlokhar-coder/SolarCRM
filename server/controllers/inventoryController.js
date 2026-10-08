const { Indent, IndentMaterial, WarehouseMaterial, GatePass, GatePassItem, Inward, InwardItem, CartItem } = require('../models/Inventory');
const { SiteExpenseLedger } = require('../models/SiteExpenseLedger');
const { ProjectMaster } = require('../models/ProjectMaster');
const { Op } = require('sequelize');

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
            const matRecords = materials.map(m => {
                const grp = (m.materialGroup || '').trim();
                const cat = (m.categoryType || '').trim();
                const spec = (m.specification || '').trim();
                const autoName = [grp, cat, spec].filter(Boolean).join(' - ');
                return {
                    indentId: createdIndent.id,
                    materialName: m.materialName && m.materialName.trim() ? m.materialName.trim() : (autoName || 'Solar Component'),
                    materialGroup: grp || null,
                    categoryType: cat || null,
                    specification: spec || null,
                    quantity: parseFloat(m.quantity) || 1,
                    unit: m.unit || 'Nos',
                    status: m.status || 'Ready to issue',
                    poWo: !!m.poWo
                };
            });
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
                const matRecords = materials.map(m => {
                    const grp = (m.materialGroup || '').trim();
                    const cat = (m.categoryType || '').trim();
                    const spec = (m.specification || '').trim();
                    const autoName = [grp, cat, spec].filter(Boolean).join(' - ');
                    return {
                        indentId: id,
                        materialName: m.materialName && m.materialName.trim() ? m.materialName.trim() : (autoName || 'Solar Component'),
                        materialGroup: grp || null,
                        categoryType: cat || null,
                        specification: spec || null,
                        quantity: parseFloat(m.quantity) || 1,
                        unit: m.unit || 'Nos',
                        status: m.status || 'Ready to issue',
                        poWo: !!m.poWo
                    };
                });
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
// Helper: Auto-compute Warehouse Stock Status based on material thresholds
function computeWarehouseStockStatus(materialName, unit, inStock) {
    const stock = typeof inStock === 'number' ? inStock : (parseFloat(inStock) || 0);
    if (stock <= 0) {
        return 'Out of Stock';
    }

    const name = (materialName || '').toLowerCase().trim();
    const u = (unit || '').toLowerCase().trim();

    // 1. Cables: if unit is meter or name has cable and unit is meter: <= 100 is Low Stock
    if (u.includes('meter') || u.includes('mtr') || u === 'm') {
        return stock <= 100 ? 'Low Stock' : 'In Stock';
    }
    if (name.includes('cable')) {
        if (u.includes('meter') || u.includes('mtr') || u === 'm' || !u) {
            return stock <= 100 ? 'Low Stock' : 'In Stock';
        }
        return stock <= 5 ? 'Low Stock' : 'In Stock';
    }

    // 2. Lighting Arrestor: below 3 (< 3) is Low Stock
    if (name.includes('arrestor') || name.includes('arrester')) {
        return stock < 3 ? 'Low Stock' : 'In Stock';
    }

    // 3. Inverter: less than 2 (< 2) is Low Stock
    if (name.includes('inverter')) {
        return stock < 2 ? 'Low Stock' : 'In Stock';
    }

    // 4. Chamber: 6 or less (<= 6) is Low Stock
    if (name.includes('chamber')) {
        return stock <= 6 ? 'Low Stock' : 'In Stock';
    }

    // 5. DB Boxes set: less than 2 (< 2) is Low Stock
    if (
        name.includes('db box') ||
        name.includes('db boxes') ||
        name.includes('acdb') ||
        name.includes('dcdb') ||
        name.includes('distribution box')
    ) {
        return stock < 2 ? 'Low Stock' : 'In Stock';
    }

    // 6. Lugs: 10 or less (<= 10) is Low Stock
    if (name.includes('lug')) {
        return stock <= 10 ? 'Low Stock' : 'In Stock';
    }

    // 7. Default for other materials: 5 or less is Low Stock
    return stock <= 5 ? 'Low Stock' : 'In Stock';
}

async function getAllWarehouseMaterials(req, res) {
    try {
        const items = await WarehouseMaterial.findAll({
            order: [['materialName', 'ASC']]
        });
        // Ensure status reflects live automated threshold calculation
        const mapped = items.map(item => {
            const computed = computeWarehouseStockStatus(item.materialName, item.unit, item.inStock);
            if (item.status !== computed) {
                item.status = computed;
                // Asynchronously sync DB if status differed
                item.update({ status: computed }).catch(() => {});
            }
            return item;
        });
        res.json({ success: true, data: mapped });
    } catch (err) {
        console.error('Error fetching warehouse materials:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch warehouse materials' });
    }
}

async function createWarehouseMaterial(req, res) {
    try {
        const { materialName, materialGroup, categoryType, specification, description, unit, inStock } = req.body;
        const grp = (materialGroup || '').trim();
        const cat = (categoryType || '').trim();
        const spec = (specification || '').trim();
        const autoName = [grp, cat && cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || grp;
        const finalName = (materialName && materialName.trim()) ? materialName.trim() : autoName;

        if (!finalName && !spec) {
            return res.status(400).json({ success: false, message: 'Material name or specification is required.' });
        }

        const stockNum = parseFloat(inStock) || 0;
        const autoStatus = computeWarehouseStockStatus(finalName || spec, unit, stockNum);

        const created = await WarehouseMaterial.create({
            materialName: finalName || spec,
            materialGroup: grp || null,
            categoryType: cat || null,
            specification: spec || null,
            description: description ? description.trim() : '',
            unit: unit || 'Nos',
            inStock: stockNum,
            status: autoStatus
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

        const grp = req.body.materialGroup !== undefined ? (req.body.materialGroup || '').trim() : item.materialGroup;
        const cat = req.body.categoryType !== undefined ? (req.body.categoryType || '').trim() : item.categoryType;
        const spec = req.body.specification !== undefined ? (req.body.specification || '').trim() : item.specification;
        let finalName = req.body.materialName !== undefined ? (req.body.materialName || '').trim() : item.materialName;
        if (!finalName) {
            finalName = [grp, cat && cat !== 'Standard' ? cat : '', spec].filter(Boolean).join(' - ') || spec || item.materialName;
        }

        const unit = req.body.unit !== undefined ? req.body.unit : item.unit;
        const inStock = req.body.inStock !== undefined ? parseFloat(req.body.inStock) || 0 : item.inStock;
        const autoStatus = computeWarehouseStockStatus(finalName, unit, inStock);

        await item.update({
            ...req.body,
            materialName: finalName,
            materialGroup: grp || null,
            categoryType: cat || null,
            specification: spec || null,
            inStock,
            status: autoStatus
        });
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

// --- Gate Pass Helper Functions ---
async function findMatchingProject(clientName) {
    if (!clientName || !clientName.trim()) return null;
    const clean = clientName.trim();

    // 1. Check for SP code like SP427 or SP-427 or SP 427
    const spMatch = clean.match(/SP[-\s]?(\d+)/i);
    if (spMatch) {
        const siteId = `SP${spMatch[1]}`;
        const proj = await ProjectMaster.findOne({
            where: {
                [Op.or]: [
                    { siteId: siteId },
                    { siteId: { [Op.like]: `%${spMatch[1]}%` } },
                    { clientName: { [Op.like]: `%${clean}%` } }
                ]
            }
        });
        if (proj) return proj;
    }

    // 2. Exact or partial match on clientName
    let proj = await ProjectMaster.findOne({
        where: { clientName: clean }
    });
    if (proj) return proj;

    proj = await ProjectMaster.findOne({
        where: {
            [Op.or]: [
                { clientName: { [Op.like]: `%${clean}%` } },
                { siteId: clean }
            ]
        }
    });
    return proj;
}

async function deductWarehouseStock(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    for (const it of items) {
        const name = (it.materialName || '').trim();
        const grp = (it.materialGroup || '').trim();
        const spec = (it.specification || '').trim();
        const qty = parseFloat(it.quantity) || 0;
        if ((!name && !spec) || qty <= 0) continue;

        let mat = null;
        if (grp && spec) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    materialGroup: grp,
                    specification: spec
                }
            });
        }
        if (!mat && spec) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    specification: spec
                }
            });
        }
        if (!mat && name) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    materialName: { [Op.like]: name }
                }
            });
        }
        if (mat) {
            const currentStock = parseFloat(mat.inStock) || 0;
            const newStock = Math.max(0, currentStock - qty);
            const autoStatus = computeWarehouseStockStatus(mat.materialName, mat.unit, newStock);
            await mat.update({
                inStock: newStock,
                status: autoStatus
            });
        }
    }
}

async function restoreWarehouseStock(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    for (const it of items) {
        const name = (it.materialName || '').trim();
        const grp = (it.materialGroup || '').trim();
        const spec = (it.specification || '').trim();
        const qty = parseFloat(it.quantity) || 0;
        if ((!name && !spec) || qty <= 0) continue;

        let mat = null;
        if (grp && spec) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    materialGroup: grp,
                    specification: spec
                }
            });
        }
        if (!mat && spec) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    specification: spec
                }
            });
        }
        if (!mat && name) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    materialName: { [Op.like]: name }
                }
            });
        }
        if (mat) {
            const currentStock = parseFloat(mat.inStock) || 0;
            const newStock = currentStock + qty;
            const autoStatus = computeWarehouseStockStatus(mat.materialName, mat.unit, newStock);
            await mat.update({
                inStock: newStock,
                status: autoStatus
            });
        }
    }
}

async function addWarehouseStock(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    for (const it of items) {
        const name = (it.materialName || '').trim();
        const grp = (it.materialGroup || '').trim();
        const cat = (it.categoryType || '').trim();
        const spec = (it.specification || '').trim();
        const unit = (it.unit || 'Nos').trim();
        const qty = parseFloat(it.quantity) || 0;
        if ((!name && !spec) || qty <= 0) continue;

        let mat = null;
        if (grp && spec) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    materialGroup: grp,
                    specification: spec
                }
            });
        }
        if (!mat && spec) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    specification: spec
                }
            });
        }
        if (!mat && name) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    materialName: { [Op.like]: name }
                }
            });
        }
        if (mat) {
            const currentStock = parseFloat(mat.inStock) || 0;
            const newStock = currentStock + qty;
            const autoStatus = computeWarehouseStockStatus(mat.materialName, mat.unit || unit, newStock);
            await mat.update({
                inStock: newStock,
                status: autoStatus
            });
        } else {
            // Material doesn't exist yet in warehouse stock, auto-create it!
            const autoName = name || [grp, cat, spec].filter(Boolean).join(' - ') || 'Material';
            const autoStatus = computeWarehouseStockStatus(autoName, unit, qty);
            await WarehouseMaterial.create({
                materialName: autoName,
                materialGroup: grp || null,
                categoryType: cat || null,
                specification: spec || null,
                unit: unit || 'Nos',
                inStock: qty,
                status: autoStatus
            });
        }
    }
}

async function revertInwardWarehouseStock(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    for (const it of items) {
        const name = (it.materialName || '').trim();
        const grp = (it.materialGroup || '').trim();
        const spec = (it.specification || '').trim();
        const qty = parseFloat(it.quantity) || 0;
        if ((!name && !spec) || qty <= 0) continue;

        let mat = null;
        if (grp && spec) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    materialGroup: grp,
                    specification: spec
                }
            });
        }
        if (!mat && spec) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    specification: spec
                }
            });
        }
        if (!mat && name) {
            mat = await WarehouseMaterial.findOne({
                where: {
                    materialName: { [Op.like]: name }
                }
            });
        }
        if (mat) {
            const currentStock = parseFloat(mat.inStock) || 0;
            const newStock = Math.max(0, currentStock - qty);
            const autoStatus = computeWarehouseStockStatus(mat.materialName, mat.unit, newStock);
            await mat.update({
                inStock: newStock,
                status: autoStatus
            });
        }
    }
}

async function syncGatePassToExpensesAndBom(gatePass, items) {
    try {
        if (!gatePass || !gatePass.clientName) return;
        const project = await findMatchingProject(gatePass.clientName);
        if (!project) return;

        const siteId = project.siteId;
        const gpId = gatePass.id;

        // 1. Remove previous expense entries for this Gate Pass (handles updates cleanly)
        await SiteExpenseLedger.destroy({
            where: {
                siteId: siteId,
                billVoucher: {
                    [Op.or]: [
                        `GP-${gpId}`,
                        `GP-${gpId}-TRANS`
                    ]
                }
            }
        });

        // 2. Create expense entry for materials dispatched
        const validItems = Array.isArray(items) ? items : [];
        for (const it of validItems) {
            const qty = parseFloat(it.quantity) || 0;
            const rate = parseFloat(it.rate) || 0;
            const amt = it.amount !== undefined && it.amount !== null ? (parseFloat(it.amount) || 0) : (qty * rate);

            await SiteExpenseLedger.create({
                expenseDate: it.dispatchDate || gatePass.gatePassDate || new Date().toISOString().substring(0, 10),
                siteId: siteId,
                clientName: project.clientName,
                clientSiteName: project.location || project.clientName,
                mop: 'Warehouse',
                category: 'Warehouse',
                paymentThrough: 'GatePass',
                paidBy: gatePass.siteEngineer || 'Warehouse Dispatch',
                billVoucher: `GP-${gpId}`,
                purpose: `Gate Pass: ${it.materialName || 'Material'} (${qty} ${it.unit || 'Nos'})`,
                amount: amt,
                remarks: gatePass.remarks || ''
            });
        }

        // 3. Create expense entry for transportCost if > 0
        const transportCost = parseFloat(gatePass.transportCost) || 0;
        if (transportCost > 0) {
            await SiteExpenseLedger.create({
                expenseDate: gatePass.gatePassDate || new Date().toISOString().substring(0, 10),
                siteId: siteId,
                clientName: project.clientName,
                clientSiteName: project.location || project.clientName,
                mop: 'GatePass',
                category: 'Warehouse',
                paymentThrough: 'GatePass',
                paidBy: gatePass.siteEngineer || 'Warehouse Dispatch',
                billVoucher: `GP-${gpId}-TRANS`,
                purpose: `Transport Cost - Gate Pass #${gpId}`,
                amount: transportCost,
                remarks: gatePass.remarks || ''
            });
        }

        // 4. Recalculate ProjectMaster.siteExpenses from SiteExpenseLedger
        const totalExp = await SiteExpenseLedger.sum('amount', { where: { siteId: siteId } }) || 0;
        project.siteExpenses = parseFloat(Number(totalExp).toFixed(2));

        // 5. Update ProjectMaster.bomItems
        let bomItems = [];
        if (project.bomItems) {
            if (typeof project.bomItems === 'string') {
                try { bomItems = JSON.parse(project.bomItems); } catch(e) { bomItems = []; }
            } else if (Array.isArray(project.bomItems)) {
                bomItems = [...project.bomItems];
            }
        }

        if (bomItems.length > 0) {
            validItems.forEach(it => {
                const matName = (it.materialName || '').toLowerCase().trim();
                const itQty = parseFloat(it.quantity) || 0;
                const itAmt = it.amount !== undefined && it.amount !== null ? (parseFloat(it.amount) || 0) : (itQty * (parseFloat(it.rate) || 0));

                const itGrp = (it.materialGroup || '').toLowerCase().trim();
                const itCat = (it.categoryType || '').toLowerCase().trim();
                const itSpec = (it.specification || '').toLowerCase().trim();

                let matched = bomItems.find(b => {
                    const grp = (b.materialGroup || '').toLowerCase().trim();
                    const cat = (b.categoryType || '').toLowerCase().trim();
                    const spec = (b.specification || '').toLowerCase().trim();

                    // 1. Exact match on group and specification
                    if (itGrp && itSpec && grp === itGrp && spec === itSpec) {
                        if (!itCat || !cat || itCat === cat) return true;
                    }
                    // 2. Exact match on specification
                    if (itSpec && spec === itSpec) return true;

                    // 3. Fallback to substring matching on materialName
                    return matName.includes(grp) || grp.includes(matName) || 
                           matName.includes(cat) || cat.includes(matName) ||
                           matName.includes(spec) || spec.includes(matName);
                });

                if (matched) {
                    matched.isDispatched = true;
                    matched.dispatchedQty = (matched.dispatchedQty || 0) + itQty;
                    matched.dispatchDate = it.dispatchDate || gatePass.gatePassDate;
                    matched.allocatedExpenseAmount = (matched.allocatedExpenseAmount || 0) + itAmt;
                    matched.expenseSource = 'Warehouse';
                    matched.invoiceRef = `GP-${gpId}`;
                    matched.warehouseUnitsDrawn = (matched.warehouseUnitsDrawn || 0) + itQty;
                }
            });

            if (transportCost > 0) {
                let transItem = bomItems.find(b => (b.materialGroup || '').toLowerCase().includes('transport'));
                if (transItem) {
                    transItem.isDispatched = true;
                    transItem.allocatedExpenseAmount = (transItem.allocatedExpenseAmount || 0) + transportCost;
                    transItem.expenseSource = 'Warehouse';
                    transItem.invoiceRef = `GP-${gpId}`;
                }
            }

            project.bomItems = JSON.stringify(bomItems);
        }

        await project.save();
    } catch (err) {
        console.error('Error syncing Gate Pass to Expenses & BOM:', err);
    }
}

async function removeGatePassExpensesAndRestoreStock(gatePass) {
    try {
        if (!gatePass) return;
        if (Array.isArray(gatePass.items) && gatePass.items.length > 0) {
            await restoreWarehouseStock(gatePass.items);
        }

        const gpId = gatePass.id;
        const project = await findMatchingProject(gatePass.clientName);
        if (project) {
            await SiteExpenseLedger.destroy({
                where: {
                    siteId: project.siteId,
                    billVoucher: {
                        [Op.or]: [
                            `GP-${gpId}`,
                            `GP-${gpId}-TRANS`
                        ]
                    }
                }
            });
            const totalExp = await SiteExpenseLedger.sum('amount', { where: { siteId: project.siteId } }) || 0;
            project.siteExpenses = parseFloat(Number(totalExp).toFixed(2));
            await project.save();
        }
    } catch (err) {
        console.error('Error in removeGatePassExpensesAndRestoreStock:', err);
    }
}

async function createGatePass(req, res) {
    try {
        let { gatePassNo, gatePassDate, descriptions, unit, quantity, clientName, siteEngineer, remarks, items, transportCost } = req.body;
        if (!clientName || !clientName.trim()) {
            return res.status(400).json({ success: false, message: 'Client name is required.' });
        }

        const parsedTransportCost = transportCost !== undefined ? (parseFloat(transportCost) || 0) : 0;

        // Auto-compute descriptions, total quantity, unit, and totalAmount from multiple items if provided
        let calculatedTotalAmount = 0;
        if (Array.isArray(items) && items.length > 0) {
            descriptions = items.map(m => m.materialName || 'Material').join(', ');
            quantity = items.reduce((sum, m) => sum + (parseFloat(m.quantity) || 0), 0);
            unit = items.length === 1 ? (items[0].unit || 'Nos') : `${items.length} Items`;
            calculatedTotalAmount = items.reduce((sum, m) => {
                const q = parseFloat(m.quantity) || 0;
                const r = parseFloat(m.rate) || 0;
                const a = m.amount !== undefined ? (parseFloat(m.amount) || 0) : (q * r);
                return sum + a;
            }, 0);
        } else if (req.body.totalAmount !== undefined) {
            calculatedTotalAmount = parseFloat(req.body.totalAmount) || 0;
        }

        // Add transport cost to total amount
        calculatedTotalAmount += parsedTransportCost;

        if (!descriptions || !descriptions.trim()) {
            return res.status(400).json({ success: false, message: 'Descriptions / Materials are required.' });
        }

        const created = await GatePass.create({
            gatePassNo: gatePassNo ? gatePassNo.trim() : null,
            gatePassDate: gatePassDate || new Date().toISOString().substring(0, 10),
            descriptions: descriptions.trim(),
            unit: unit || 'Nos',
            quantity: parseFloat(quantity) || 1,
            clientName: clientName.trim(),
            siteEngineer: siteEngineer || 'Dinesh Kumar',
            remarks: remarks ? remarks.trim() : '',
            totalAmount: calculatedTotalAmount,
            transportCost: parsedTransportCost
        });

        // Insert nested items if provided
        if (Array.isArray(items) && items.length > 0) {
            const itemRecords = items.map(m => {
                const q = parseFloat(m.quantity) || 0;
                const r = parseFloat(m.rate) || 0;
                const a = m.amount !== undefined ? (parseFloat(m.amount) || 0) : (q * r);
                const grp = (m.materialGroup || '').trim();
                const cat = (m.categoryType || '').trim();
                const spec = (m.specification || '').trim();
                const autoName = [grp, cat, spec].filter(Boolean).join(' - ');
                return {
                    gatePassId: created.id,
                    dispatchDate: m.dispatchDate || gatePassDate || new Date().toISOString().substring(0, 10),
                    materialName: m.materialName && m.materialName.trim() ? m.materialName.trim() : (autoName || 'Material'),
                    materialGroup: grp || null,
                    categoryType: cat || null,
                    specification: spec || null,
                    quantity: q,
                    unit: m.unit || 'Nos',
                    rate: r,
                    vendorName: (m.vendorName || '').trim(),
                    amount: a
                };
            });
            await GatePassItem.bulkCreate(itemRecords);
        }

        // 1. Deduct Warehouse Stock
        if (Array.isArray(items) && items.length > 0) {
            await deductWarehouseStock(items);
        }

        // 2. Synchronize to SiteExpenseLedger & Project BOM
        await syncGatePassToExpensesAndBom(created, items);

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
        let { gatePassNo, gatePassDate, descriptions, unit, quantity, clientName, siteEngineer, remarks, items, totalAmount, transportCost } = req.body;
        const pass = await GatePass.findByPk(id, {
            include: [{ model: GatePassItem, as: 'items' }]
        });
        if (!pass) {
            return res.status(404).json({ success: false, message: 'Gate pass not found' });
        }

        // 1. Restore previous stock before applying updates
        if (pass.items && pass.items.length > 0) {
            await restoreWarehouseStock(pass.items);
        }

        const parsedTransportCost = transportCost !== undefined ? (parseFloat(transportCost) || 0) : (pass.transportCost || 0);

        // Auto-compute descriptions, total quantity, unit, and totalAmount from multiple items if provided
        let calculatedTotalAmount = totalAmount !== undefined ? parseFloat(totalAmount) || 0 : (pass.totalAmount || 0);
        if (Array.isArray(items) && items.length > 0) {
            descriptions = items.map(m => m.materialName || 'Material').join(', ');
            quantity = items.reduce((sum, m) => sum + (parseFloat(m.quantity) || 0), 0);
            unit = items.length === 1 ? (items[0].unit || 'Nos') : `${items.length} Items`;
            calculatedTotalAmount = items.reduce((sum, m) => {
                const q = parseFloat(m.quantity) || 0;
                const r = parseFloat(m.rate) || 0;
                const a = m.amount !== undefined ? (parseFloat(m.amount) || 0) : (q * r);
                return sum + a;
            }, 0);
            calculatedTotalAmount += parsedTransportCost;
        }

        await pass.update({
            gatePassNo: gatePassNo !== undefined ? (gatePassNo ? gatePassNo.trim() : null) : pass.gatePassNo,
            gatePassDate: gatePassDate || pass.gatePassDate,
            descriptions: descriptions !== undefined ? descriptions.trim() : pass.descriptions,
            unit: unit !== undefined ? unit : pass.unit,
            quantity: quantity !== undefined ? parseFloat(quantity) || pass.quantity : pass.quantity,
            clientName: clientName !== undefined ? clientName.trim() : pass.clientName,
            siteEngineer: siteEngineer !== undefined ? siteEngineer : pass.siteEngineer,
            remarks: remarks !== undefined ? (remarks ? remarks.trim() : '') : pass.remarks,
            totalAmount: calculatedTotalAmount,
            transportCost: parsedTransportCost
        });

        // Replace nested items if provided
        if (Array.isArray(items)) {
            await GatePassItem.destroy({ where: { gatePassId: id } });
            if (items.length > 0) {
                const itemRecords = items.map(m => {
                    const q = parseFloat(m.quantity) || 0;
                    const r = parseFloat(m.rate) || 0;
                    const a = m.amount !== undefined ? (parseFloat(m.amount) || 0) : (q * r);
                    const grp = (m.materialGroup || '').trim();
                    const cat = (m.categoryType || '').trim();
                    const spec = (m.specification || '').trim();
                    const autoName = [grp, cat, spec].filter(Boolean).join(' - ');
                    return {
                        gatePassId: id,
                        dispatchDate: m.dispatchDate || pass.gatePassDate || new Date().toISOString().substring(0, 10),
                        materialName: m.materialName && m.materialName.trim() ? m.materialName.trim() : (autoName || 'Material'),
                        materialGroup: grp || null,
                        categoryType: cat || null,
                        specification: spec || null,
                        quantity: q,
                        unit: m.unit || 'Nos',
                        rate: r,
                        vendorName: (m.vendorName || '').trim(),
                        amount: a
                    };
                });
                await GatePassItem.bulkCreate(itemRecords);
            }
        }

        // 2. Deduct new stock
        if (Array.isArray(items) && items.length > 0) {
            await deductWarehouseStock(items);
        }

        // 3. Synchronize to SiteExpenseLedger & Project BOM
        await syncGatePassToExpensesAndBom(pass, items);

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
        const pass = await GatePass.findByPk(id, {
            include: [{ model: GatePassItem, as: 'items' }]
        });
        if (!pass) {
            return res.status(404).json({ success: false, message: 'Gate pass not found' });
        }

        // Restore stock and remove expense entries
        await removeGatePassExpensesAndRestoreStock(pass);

        await pass.destroy();
        res.json({ success: true, message: 'Gate pass deleted' });
    } catch (err) {
        console.error('Error deleting gate pass:', err);
        res.status(500).json({ success: false, message: 'Failed to delete gate pass' });
    }
}

// ==========================================
// 4. INWARD CONTROLLER (Inward Stock Addition)
// ==========================================
async function getAllInwards(req, res) {
    try {
        const inwards = await Inward.findAll({
            include: [{ model: InwardItem, as: 'items' }],
            order: [['inwardDate', 'DESC'], ['id', 'DESC']]
        });
        res.json({ success: true, data: inwards });
    } catch (err) {
        console.error('Error fetching inwards:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch inward entries' });
    }
}

async function createInward(req, res) {
    try {
        let { inwardNo, inwardDate, descriptions, unit, quantity, supplierName, clientName, receivedBy, siteEngineer, remarks, items, transportCost } = req.body;
        
        const finalSupplier = (supplierName || clientName || '').trim();
        const finalReceiver = (receivedBy || siteEngineer || 'Soundarajan').trim();
        const parsedTransportCost = transportCost !== undefined ? (parseFloat(transportCost) || 0) : 0;

        let calculatedTotalAmount = 0;
        if (Array.isArray(items) && items.length > 0) {
            descriptions = items.map(m => m.materialName || 'Material').join(', ');
            quantity = items.reduce((sum, m) => sum + (parseFloat(m.quantity) || 0), 0);
            unit = items.length === 1 ? (items[0].unit || 'Nos') : `${items.length} Items`;
            calculatedTotalAmount = items.reduce((sum, m) => {
                const q = parseFloat(m.quantity) || 0;
                const r = parseFloat(m.rate) || 0;
                const a = m.amount !== undefined ? (parseFloat(m.amount) || 0) : (q * r);
                return sum + a;
            }, 0);
        } else if (req.body.totalAmount !== undefined) {
            calculatedTotalAmount = parseFloat(req.body.totalAmount) || 0;
        }

        calculatedTotalAmount += parsedTransportCost;

        if (!descriptions || !descriptions.trim()) {
            descriptions = 'Inward Material';
        }

        const created = await Inward.create({
            inwardNo: inwardNo ? inwardNo.trim() : null,
            inwardDate: inwardDate || new Date().toISOString().substring(0, 10),
            descriptions: descriptions.trim(),
            unit: unit || 'Nos',
            quantity: parseFloat(quantity) || 1,
            supplierName: finalSupplier,
            receivedBy: finalReceiver,
            remarks: remarks ? remarks.trim() : '',
            totalAmount: calculatedTotalAmount,
            transportCost: parsedTransportCost
        });

        if (Array.isArray(items) && items.length > 0) {
            const itemRecords = items.map(m => {
                const q = parseFloat(m.quantity) || 0;
                const r = parseFloat(m.rate) || 0;
                const a = m.amount !== undefined ? (parseFloat(m.amount) || 0) : (q * r);
                const grp = (m.materialGroup || '').trim();
                const cat = (m.categoryType || '').trim();
                const spec = (m.specification || '').trim();
                const autoName = [grp, cat, spec].filter(Boolean).join(' - ');
                return {
                    inwardId: created.id,
                    inwardDate: m.inwardDate || inwardDate || new Date().toISOString().substring(0, 10),
                    materialName: m.materialName && m.materialName.trim() ? m.materialName.trim() : (autoName || 'Material'),
                    materialGroup: grp || null,
                    categoryType: cat || null,
                    specification: spec || null,
                    quantity: q,
                    unit: m.unit || 'Nos',
                    rate: r,
                    vendorName: (m.vendorName || finalSupplier || '').trim(),
                    amount: a
                };
            });
            await InwardItem.bulkCreate(itemRecords);
        }

        // Automatically ADD to Warehouse stock! (+)
        if (Array.isArray(items) && items.length > 0) {
            await addWarehouseStock(items);
        }

        const full = await Inward.findByPk(created.id, {
            include: [{ model: InwardItem, as: 'items' }]
        });

        res.status(201).json({ success: true, data: full });
    } catch (err) {
        console.error('Error creating inward:', err);
        res.status(500).json({ success: false, message: 'Failed to create inward record', error: err.message });
    }
}

async function updateInward(req, res) {
    try {
        const { id } = req.params;
        let { inwardNo, inwardDate, descriptions, unit, quantity, supplierName, clientName, receivedBy, siteEngineer, remarks, items, totalAmount, transportCost } = req.body;
        
        const existing = await Inward.findByPk(id, {
            include: [{ model: InwardItem, as: 'items' }]
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Inward entry not found' });
        }

        // 1. Revert previous stock (-)
        if (existing.items && existing.items.length > 0) {
            await revertInwardWarehouseStock(existing.items);
        }

        const finalSupplier = supplierName !== undefined ? supplierName.trim() : (clientName !== undefined ? clientName.trim() : existing.supplierName);
        const finalReceiver = receivedBy !== undefined ? receivedBy.trim() : (siteEngineer !== undefined ? siteEngineer.trim() : existing.receivedBy);
        const parsedTransportCost = transportCost !== undefined ? (parseFloat(transportCost) || 0) : (existing.transportCost || 0);

        let calculatedTotalAmount = totalAmount !== undefined ? parseFloat(totalAmount) || 0 : (existing.totalAmount || 0);
        if (Array.isArray(items) && items.length > 0) {
            descriptions = items.map(m => m.materialName || 'Material').join(', ');
            quantity = items.reduce((sum, m) => sum + (parseFloat(m.quantity) || 0), 0);
            unit = items.length === 1 ? (items[0].unit || 'Nos') : `${items.length} Items`;
            calculatedTotalAmount = items.reduce((sum, m) => {
                const q = parseFloat(m.quantity) || 0;
                const r = parseFloat(m.rate) || 0;
                const a = m.amount !== undefined ? (parseFloat(m.amount) || 0) : (q * r);
                return sum + a;
            }, 0);
            calculatedTotalAmount += parsedTransportCost;
        }

        await existing.update({
            inwardNo: inwardNo !== undefined ? (inwardNo ? inwardNo.trim() : null) : existing.inwardNo,
            inwardDate: inwardDate || existing.inwardDate,
            descriptions: descriptions !== undefined ? descriptions.trim() : existing.descriptions,
            unit: unit !== undefined ? unit : existing.unit,
            quantity: quantity !== undefined ? parseFloat(quantity) || existing.quantity : existing.quantity,
            supplierName: finalSupplier,
            receivedBy: finalReceiver,
            remarks: remarks !== undefined ? (remarks ? remarks.trim() : '') : existing.remarks,
            totalAmount: calculatedTotalAmount,
            transportCost: parsedTransportCost
        });

        if (Array.isArray(items)) {
            await InwardItem.destroy({ where: { inwardId: id } });
            if (items.length > 0) {
                const itemRecords = items.map(m => {
                    const q = parseFloat(m.quantity) || 0;
                    const r = parseFloat(m.rate) || 0;
                    const a = m.amount !== undefined ? (parseFloat(m.amount) || 0) : (q * r);
                    const grp = (m.materialGroup || '').trim();
                    const cat = (m.categoryType || '').trim();
                    const spec = (m.specification || '').trim();
                    const autoName = [grp, cat, spec].filter(Boolean).join(' - ');
                    return {
                        inwardId: id,
                        inwardDate: m.inwardDate || existing.inwardDate || new Date().toISOString().substring(0, 10),
                        materialName: m.materialName && m.materialName.trim() ? m.materialName.trim() : (autoName || 'Material'),
                        materialGroup: grp || null,
                        categoryType: cat || null,
                        specification: spec || null,
                        quantity: q,
                        unit: m.unit || 'Nos',
                        rate: r,
                        vendorName: (m.vendorName || finalSupplier || '').trim(),
                        amount: a
                    };
                });
                await InwardItem.bulkCreate(itemRecords);
            }
        }

        // 2. Add new updated stock (+)
        if (Array.isArray(items) && items.length > 0) {
            await addWarehouseStock(items);
        }

        const full = await Inward.findByPk(id, {
            include: [{ model: InwardItem, as: 'items' }]
        });

        res.json({ success: true, data: full });
    } catch (err) {
        console.error('Error updating inward:', err);
        res.status(500).json({ success: false, message: 'Failed to update inward record', error: err.message });
    }
}

async function deleteInward(req, res) {
    try {
        const { id } = req.params;
        const existing = await Inward.findByPk(id, {
            include: [{ model: InwardItem, as: 'items' }]
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Inward entry not found' });
        }

        // Revert added stock (-)
        if (existing.items && existing.items.length > 0) {
            await revertInwardWarehouseStock(existing.items);
        }

        await existing.destroy();
        res.json({ success: true, message: 'Inward entry deleted successfully' });
    } catch (err) {
        console.error('Error deleting inward:', err);
        res.status(500).json({ success: false, message: 'Failed to delete inward entry' });
    }
}

// ==========================================
// 5. CART ITEMS CONTROLLER (Screenshot 2)
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
        const { items, orderDate, vendorName, procurementStatus, material, clientLocation, quantity, unit, totalAmount, materialGroup, categoryType, specification } = req.body;

        // If multiple items are provided (batch creation)
        if (Array.isArray(items) && items.length > 0) {
            const validRows = items.filter(r => (r.material && r.material.trim()) || (r.specification && r.specification.trim()) || (r.materialGroup && r.materialGroup.trim()));
            if (validRows.length === 0) {
                return res.status(400).json({ success: false, message: 'At least one valid material item is required.' });
            }
            const toCreate = validRows.map(r => {
                const grp = (r.materialGroup || '').trim();
                const cat = (r.categoryType || '').trim();
                const spec = (r.specification || '').trim();
                const autoName = [grp, cat, spec].filter(Boolean).join(' - ');
                return {
                    orderDate: r.orderDate || orderDate || new Date().toISOString().substring(0, 10),
                    material: (r.material && r.material.trim()) ? r.material.trim() : (autoName || 'Material'),
                    materialGroup: grp || null,
                    categoryType: cat || null,
                    specification: spec || null,
                    clientLocation: (r.clientLocation || clientLocation || '').trim(),
                    quantity: parseFloat(r.quantity) || 1,
                    unit: r.unit || 'Nos',
                    vendorName: (r.vendorName !== undefined && r.vendorName !== '' ? r.vendorName : (vendorName || '')).trim(),
                    procurementStatus: r.procurementStatus || procurementStatus || 'Yet to Start',
                    totalAmount: parseFloat(r.totalAmount) || 0.00
                };
            });
            const createdItems = await CartItem.bulkCreate(toCreate);
            return res.status(201).json({ success: true, data: createdItems, count: createdItems.length });
        }

        // Single item fallback
        const grp = (materialGroup || '').trim();
        const cat = (categoryType || '').trim();
        const spec = (specification || '').trim();
        const autoName = [grp, cat, spec].filter(Boolean).join(' - ');
        const finalMat = (material && material.trim()) ? material.trim() : autoName;

        if (!finalMat) {
            return res.status(400).json({ success: false, message: 'Material is required.' });
        }

        const created = await CartItem.create({
            orderDate: orderDate || new Date().toISOString().substring(0, 10),
            material: finalMat,
            materialGroup: grp || null,
            categoryType: cat || null,
            specification: spec || null,
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

        const grp = (req.body.materialGroup !== undefined ? req.body.materialGroup : item.materialGroup) || '';
        const cat = (req.body.categoryType !== undefined ? req.body.categoryType : item.categoryType) || '';
        const spec = (req.body.specification !== undefined ? req.body.specification : item.specification) || '';
        let finalMat = req.body.material;
        if (!finalMat || !finalMat.trim()) {
            finalMat = [grp, cat, spec].filter(Boolean).join(' - ') || item.material;
        }

        await item.update({
            ...req.body,
            material: finalMat,
            materialGroup: grp ? grp.trim() : null,
            categoryType: cat ? cat.trim() : null,
            specification: spec ? spec.trim() : null
        });
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

async function deleteAllIndents(req, res) {
    try {
        await IndentMaterial.destroy({ where: {} });
        await Indent.destroy({ where: {} });
        res.json({ success: true, message: 'All indents cleared successfully' });
    } catch (err) {
        console.error('Error clearing indents:', err);
        res.status(500).json({ success: false, message: 'Failed to clear indents' });
    }
}

async function deleteAllWarehouseMaterials(req, res) {
    try {
        await WarehouseMaterial.destroy({ where: {} });
        res.json({ success: true, message: 'All warehouse stock materials cleared successfully' });
    } catch (err) {
        console.error('Error clearing warehouse materials:', err);
        res.status(500).json({ success: false, message: 'Failed to clear warehouse materials' });
    }
}

async function deleteAllGatePasses(req, res) {
    try {
        await GatePassItem.destroy({ where: {} });
        await GatePass.destroy({ where: {} });
        res.json({ success: true, message: 'All gate passes cleared successfully' });
    } catch (err) {
        console.error('Error clearing gate passes:', err);
        res.status(500).json({ success: false, message: 'Failed to clear gate passes' });
    }
}

async function deleteAllInwards(req, res) {
    try {
        await InwardItem.destroy({ where: {} });
        await Inward.destroy({ where: {} });
        res.json({ success: true, message: 'All inward entries cleared successfully' });
    } catch (err) {
        console.error('Error clearing inward records:', err);
        res.status(500).json({ success: false, message: 'Failed to clear inward records' });
    }
}

async function deleteAllCartItems(req, res) {
    try {
        await CartItem.destroy({ where: {} });
        res.json({ success: true, message: 'All cart items cleared successfully' });
    } catch (err) {
        console.error('Error clearing cart items:', err);
        res.status(500).json({ success: false, message: 'Failed to clear cart items' });
    }
}

// ==========================================
// 6. SEED DATA & SCHEMA GENERATOR
// ==========================================
async function seedInventoryIfEmpty() {
    try {
        const { conDb } = require('../database/database');
        try {
            await conDb.query("ALTER TABLE inventory_gate_passes ADD COLUMN gate_pass_no VARCHAR(100) NULL AFTER id;");
        } catch (e) {
            // Column already exists or table alter not required
        }
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
    deleteAllIndents,
    // Warehouse
    getAllWarehouseMaterials,
    createWarehouseMaterial,
    updateWarehouseMaterial,
    deleteWarehouseMaterial,
    deleteAllWarehouseMaterials,
    // Gate Pass
    getAllGatePasses,
    createGatePass,
    updateGatePass,
    deleteGatePass,
    deleteAllGatePasses,
    // Inward
    getAllInwards,
    createInward,
    updateInward,
    deleteInward,
    deleteAllInwards,
    // Cart
    getCartItems,
    createCartItem,
    updateCartItem,
    deleteCartItem,
    deleteAllCartItems,
    // Seed
    seedInventoryIfEmpty
};
