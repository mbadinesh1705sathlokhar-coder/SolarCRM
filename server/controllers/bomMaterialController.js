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

    // MC4 Connector
    { groupName: 'MC4 Connector', categoryType: 'Single Pair', specification: '1-in 1-out', defaultUom: 'Sets', unitRate: 60 },
    { groupName: 'MC4 Connector', categoryType: 'Branch Pair', specification: '2-in 1-out', defaultUom: 'Sets', unitRate: 180 },
    { groupName: 'MC4 Connector', categoryType: 'Branch Pair', specification: '3-in 1-out', defaultUom: 'Sets', unitRate: 250 },
    { groupName: 'MC4 Connector', categoryType: 'Branch Pair', specification: '4-in 1-out', defaultUom: 'Sets', unitRate: 320 },

    // Lugs
    { groupName: 'Lugs', categoryType: 'Cu Lug', specification: '4Sqmm', defaultUom: 'Nos', unitRate: 8 },
    { groupName: 'Lugs', categoryType: 'Cu Lug', specification: '6Sqmm', defaultUom: 'Nos', unitRate: 12 },
    { groupName: 'Lugs', categoryType: 'Cu Lug', specification: '10Sqmm', defaultUom: 'Nos', unitRate: 18 },
    { groupName: 'Lugs', categoryType: 'Al Lug', specification: '16Sqmm', defaultUom: 'Nos', unitRate: 22 },
    { groupName: 'Lugs', categoryType: 'Al Lug', specification: '25Sqmm', defaultUom: 'Nos', unitRate: 32 },
    { groupName: 'Lugs', categoryType: 'Al Lug', specification: '35Sqmm', defaultUom: 'Nos', unitRate: 45 },
    { groupName: 'Lugs', categoryType: 'Pin Lug', specification: '4Sqmm', defaultUom: 'Nos', unitRate: 10 },
    { groupName: 'Lugs', categoryType: 'Ring Lug', specification: '6Sqmm', defaultUom: 'Nos', unitRate: 14 },

    // Bucket
    { groupName: 'Bucket', categoryType: 'Conduit Accessories', specification: 'PVC Conduit Bucket', defaultUom: 'Nos', unitRate: 1500 },
    { groupName: 'Bucket', categoryType: 'Fasteners', specification: 'Hardware Fasteners Bucket', defaultUom: 'Nos', unitRate: 2500 },

    // Structure
    { groupName: 'Structure', categoryType: 'Rooftop Structure', specification: 'HDG High Structure', defaultUom: 'Kg', unitRate: 110 },
    { groupName: 'Structure', categoryType: 'Rail Profile', specification: 'Aluminium Rail Profile', defaultUom: 'Kg', unitRate: 240 },

    // Earthing & Lightning
    { groupName: 'Earthing & Lightning', categoryType: 'Earthing Rod', specification: 'Copper Bonded Rod 50mm', defaultUom: 'Sets', unitRate: 3500 },
    { groupName: 'Earthing & Lightning', categoryType: 'Lightning Arrester', specification: 'ESE Arrester Kit', defaultUom: 'Sets', unitRate: 8500 },

    // Fasteners & Hardware
    { groupName: 'Fasteners & Hardware', categoryType: 'Bolt', specification: 'SS304 Allen Bolt M8x25', defaultUom: 'Nos', unitRate: 15 },
    { groupName: 'Fasteners & Hardware', categoryType: 'Fastener', specification: 'Anchor Fastener M12x100', defaultUom: 'Nos', unitRate: 35 }
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
                unitRate: item.unitRate
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
        const { groupName, items } = req.body;
        if (!groupName) {
            return res.status(400).json({ success: false, message: 'groupName is required' });
        }

        // Delete existing items for this group
        await BomMaterialMaster.destroy({ where: { groupName: groupName.trim() } });

        if (Array.isArray(items) && items.length > 0) {
            const rows = items.map((it, idx) => ({
                groupName: groupName.trim(),
                categoryType: (it.categoryType || 'Standard').trim(),
                specification: (it.specification || '').trim(),
                defaultUom: (it.defaultUom || 'Meter').trim(),
                unitRate: Number(it.unitRate) || 0,
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
        const { groupName, categoryType, specification, defaultUom, unitRate } = req.body;
        if (!groupName || !specification) {
            return res.status(400).json({ success: false, message: 'groupName and specification are required' });
        }

        const created = await BomMaterialMaster.create({
            groupName: groupName.trim(),
            categoryType: (categoryType || 'Standard').trim(),
            specification: specification.trim(),
            defaultUom: (defaultUom || 'Meter').trim(),
            unitRate: Number(unitRate) || 0
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
