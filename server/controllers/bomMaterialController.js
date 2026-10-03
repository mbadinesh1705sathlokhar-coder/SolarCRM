const { BomMaterialMaster } = require('../models/BomMaterialMaster');

// Initial default seed items for BOM Material Master
const initialBomMaterialsSeed = [
    // Cables
    { groupName: 'Cables', categoryType: 'AC Cable', specification: '4Sqmm', defaultUom: 'Meter', unitRate: 50 },
    { groupName: 'Cables', categoryType: 'AC Cable', specification: '6Sqmm', defaultUom: 'Meter', unitRate: 75 },
    { groupName: 'Cables', categoryType: 'AC Cable', specification: '10Sqmm', defaultUom: 'Meter', unitRate: 120 },
    { groupName: 'Cables', categoryType: 'AC Cable', specification: '16Sqmm', defaultUom: 'Meter', unitRate: 180 },
    { groupName: 'Cables', categoryType: 'AC Cable', specification: '25Sqmm', defaultUom: 'Meter', unitRate: 260 },
    { groupName: 'Cables', categoryType: 'DC Cable', specification: 'XLPO 4Sqmm', defaultUom: 'Meter', unitRate: 45 },
    { groupName: 'Cables', categoryType: 'DC Cable', specification: 'XLPO 6Sqmm', defaultUom: 'Meter', unitRate: 65 },
    { groupName: 'Cables', categoryType: 'DC Cable', specification: '10Sqmm', defaultUom: 'Meter', unitRate: 110 },

    // Panels
    { groupName: 'Panels', categoryType: 'Mono PERC', specification: '540W', defaultUom: 'Nos', unitRate: 12500 },
    { groupName: 'Panels', categoryType: 'Mono PERC', specification: '550W', defaultUom: 'Nos', unitRate: 13000 },
    { groupName: 'Panels', categoryType: 'TOPCon', specification: '580W', defaultUom: 'Nos', unitRate: 14500 },
    { groupName: 'Panels', categoryType: 'Polycrystalline', specification: '335W', defaultUom: 'Nos', unitRate: 7500 },
    { groupName: 'Panels', categoryType: 'Polycrystalline', specification: '340W', defaultUom: 'Nos', unitRate: 7800 },

    // Inverters
    { groupName: 'Inverters', categoryType: 'On Grid', specification: '3kW', defaultUom: 'Nos', unitRate: 28000 },
    { groupName: 'Inverters', categoryType: 'On Grid', specification: '5kW', defaultUom: 'Nos', unitRate: 38000 },
    { groupName: 'Inverters', categoryType: 'On Grid', specification: '10kW', defaultUom: 'Nos', unitRate: 65000 },
    { groupName: 'Inverters', categoryType: 'On Grid', specification: '15kW', defaultUom: 'Nos', unitRate: 85000 },
    { groupName: 'Inverters', categoryType: 'On Grid', specification: '20kW', defaultUom: 'Nos', unitRate: 105000 },
    { groupName: 'Inverters', categoryType: 'Hybrid', specification: '5kW', defaultUom: 'Nos', unitRate: 68000 },
    { groupName: 'Inverters', categoryType: 'Hybrid', specification: '10kW', defaultUom: 'Nos', unitRate: 115000 },
    // Civil & Miscellaneous
    { groupName: 'Civil & Miscellaneous', categoryType: 'Civil', specification: 'General Civil Work', defaultUom: 'Nos', unitRate: 5000, gstPercent: 18 },
    { groupName: 'Civil & Miscellaneous', categoryType: 'Foundation', specification: 'Masonry & Foundation', defaultUom: 'Nos', unitRate: 8000, gstPercent: 18 },

    // Consumables
    { groupName: 'Consumables', categoryType: 'Conduit', specification: 'PVC Conduit Accessories', defaultUom: 'Nos', unitRate: 1500, gstPercent: 18 },
    { groupName: 'Consumables', categoryType: 'Earthing', specification: 'Chemical Earthing Compound', defaultUom: 'Nos', unitRate: 1200, gstPercent: 18 },

    // Earthing Protection
    { groupName: 'Earthing Protection', categoryType: 'Earthing Rod', specification: 'Copper Bonded Chemical Rod 50mm', defaultUom: 'Sets', unitRate: 3500, gstPercent: 18 },
    { groupName: 'Earthing Protection', categoryType: 'Lightning Arrester', specification: 'ESE Lightning Arrester Kit', defaultUom: 'Sets', unitRate: 8500, gstPercent: 18 },

    // Module Mounting Structures
    { groupName: 'Module Mounting Structures', categoryType: 'Rooftop Structure', specification: 'HDG Rooftop High Structure', defaultUom: 'Kg', unitRate: 110, gstPercent: 18 },
    { groupName: 'Module Mounting Structures', categoryType: 'Rail Profile', specification: 'Aluminium Rail Profile', defaultUom: 'Kg', unitRate: 240, gstPercent: 18 },

    // Tata SPG Package
    { groupName: 'Tata SPG Package', categoryType: '3kW Kit', specification: 'Complete TATA SPG 3kW Kit', defaultUom: 'Nos', unitRate: 180000, gstPercent: 12 },
    { groupName: 'Tata SPG Package', categoryType: '5kW Kit', specification: 'Complete TATA SPG 5kW Kit', defaultUom: 'Nos', unitRate: 280000, gstPercent: 12 },
    { groupName: 'Tata SPG Package', categoryType: '10kW Kit', specification: 'Complete TATA SPG 10kW Kit', defaultUom: 'Nos', unitRate: 550000, gstPercent: 12 },

    // Waree
    { groupName: 'Waree', categoryType: 'Panels', specification: 'Waaree Solar Panels Kit', defaultUom: 'Nos', unitRate: 125000, gstPercent: 12 },
    { groupName: 'Waree', categoryType: 'Inverter', specification: 'Waaree Inverter Package', defaultUom: 'Nos', unitRate: 45000, gstPercent: 18 }
];

async function seedBomMaterialsIfEmpty() {
    try {
        const count = await BomMaterialMaster.count();
        if (count === 0) {
            console.log('Seeding initial BOM Material Master specifications...');
            await BomMaterialMaster.bulkCreate(initialBomMaterialsSeed);
            console.log('Successfully seeded BOM Material Master specifications!');
        }
    } catch (err) {
        console.error('Error seeding BOM Material Master:', err);
    }
}

// GET all BOM materials
async function getAllBomMaterials(req, res) {
    try {
        const items = await BomMaterialMaster.findAll({
            order: [
                ['groupName', 'ASC'],
                ['categoryType', 'ASC'],
                ['sortOrder', 'ASC'],
                ['id', 'ASC']
            ]
        });

        // Group by groupName
        const grouped = {};
        items.forEach(item => {
            const grp = item.groupName;
            if (!grouped[grp]) {
                grouped[grp] = [];
            }
            grouped[grp].push({
                id: item.id,
                groupName: item.groupName,
                categoryType: item.categoryType,
                specification: item.specification,
                defaultUom: item.defaultUom,
                unitRate: item.unitRate,
                gstPercent: item.gstPercent !== undefined ? Number(item.gstPercent) : (item.groupName === 'Panels' ? 12 : 18)
            });
        });

        res.json({
            success: true,
            data: items,
            grouped: grouped
        });
    } catch (err) {
        console.error('Error fetching BOM materials:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch BOM materials', error: err.message });
    }
}

// BULK SAVE / UPDATE for a specific Material Group (from Add List UI)
async function saveMaterialGroupSpecs(req, res) {
    try {
        const { groupName, items, groupGstPercent } = req.body;
        if (!groupName) {
            return res.status(400).json({ success: false, message: 'groupName is required' });
        }

        // Delete existing items for this group
        await BomMaterialMaster.destroy({ where: { groupName: groupName.trim() } });

        if (Array.isArray(items) && items.length > 0) {
            const defaultGst = groupGstPercent !== undefined ? Number(groupGstPercent) : (groupName.trim() === 'Panels' ? 12 : 18);
            const rows = items.map((it, idx) => ({
                groupName: groupName.trim(),
                categoryType: (it.categoryType || 'Standard').trim(),
                specification: (it.specification || '').trim(),
                defaultUom: (it.defaultUom || 'Meter').trim(),
                unitRate: Number(it.unitRate) || 0,
                gstPercent: it.gstPercent !== undefined ? Number(it.gstPercent) : defaultGst,
                sortOrder: idx + 1
            })).filter(r => r.specification.length > 0);

            if (rows.length > 0) {
                await BomMaterialMaster.bulkCreate(rows);
            }
        }

        const updated = await BomMaterialMaster.findAll({
            where: { groupName: groupName.trim() },
            order: [['sortOrder', 'ASC'], ['id', 'ASC']]
        });

        res.json({
            success: true,
            message: `Updated specifications for "${groupName}" successfully.`,
            data: updated
        });
    } catch (err) {
        console.error('Error saving BOM material group specs:', err);
        res.status(500).json({ success: false, message: 'Failed to save material specs', error: err.message });
    }
}

// CREATE single item
async function createBomMaterialItem(req, res) {
    try {
        const { groupName, categoryType, specification, defaultUom, unitRate, gstPercent } = req.body;
        if (!groupName || !specification) {
            return res.status(400).json({ success: false, message: 'groupName and specification are required' });
        }

        const defaultGst = gstPercent !== undefined ? Number(gstPercent) : (groupName.trim() === 'Panels' ? 12 : 18);
        const created = await BomMaterialMaster.create({
            groupName: groupName.trim(),
            categoryType: (categoryType || 'Standard').trim(),
            specification: specification.trim(),
            defaultUom: (defaultUom || 'Meter').trim(),
            unitRate: Number(unitRate) || 0,
            gstPercent: defaultGst
        });

        res.status(201).json({ success: true, data: created });
    } catch (err) {
        console.error('Error creating BOM material item:', err);
        res.status(500).json({ success: false, message: 'Failed to create item', error: err.message });
    }
}

// DELETE single item
async function deleteBomMaterialItem(req, res) {
    try {
        const { id } = req.params;
        const item = await BomMaterialMaster.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        await item.destroy();
        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (err) {
        console.error('Error deleting BOM material item:', err);
        res.status(500).json({ success: false, message: 'Failed to delete item', error: err.message });
    }
}

module.exports = {
    seedBomMaterialsIfEmpty,
    getAllBomMaterials,
    saveMaterialGroupSpecs,
    createBomMaterialItem,
    deleteBomMaterialItem
};
