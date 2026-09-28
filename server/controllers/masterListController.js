const { MasterList, MasterListItem } = require('../models/MasterList');

// GET all master lists with items
async function getAllLists(req, res) {
    try {
        const lists = await MasterList.findAll({
            include: [{
                model: MasterListItem,
                as: 'items',
                attributes: ['id', 'itemValue', 'sortOrder']
            }],
            order: [
                ['id', 'ASC'],
                [{ model: MasterListItem, as: 'items' }, 'sortOrder', 'ASC'],
                [{ model: MasterListItem, as: 'items' }, 'id', 'ASC']
            ]
        });

        // Format clean output with items array
        const formatted = lists.map(l => ({
            id: l.id,
            title: l.title,
            category: l.category,
            description: l.description,
            items: (l.items || []).map(it => it.itemValue),
            itemRecords: l.items || [],
            createdAt: l.createdAt,
            updatedAt: l.updatedAt
        }));

        res.json({ success: true, data: formatted });
    } catch (err) {
        console.error('Error fetching master lists:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch configuration lists', error: err.message });
    }
}

// GET single list by ID or Title
async function getListByTitleOrId(req, res) {
    try {
        const { idOrTitle } = req.params;
        let whereClause = {};
        if (/^\d+$/.test(idOrTitle)) {
            whereClause = { id: parseInt(idOrTitle, 10) };
        } else {
            whereClause = { title: decodeURIComponent(idOrTitle) };
        }

        const list = await MasterList.findOne({
            where: whereClause,
            include: [{
                model: MasterListItem,
                as: 'items',
                attributes: ['id', 'itemValue', 'sortOrder']
            }],
            order: [
                [{ model: MasterListItem, as: 'items' }, 'sortOrder', 'ASC'],
                [{ model: MasterListItem, as: 'items' }, 'id', 'ASC']
            ]
        });

        if (!list) {
            return res.status(404).json({ success: false, message: 'List not found' });
        }

        res.json({
            success: true,
            data: {
                id: list.id,
                title: list.title,
                category: list.category,
                description: list.description,
                items: (list.items || []).map(it => it.itemValue),
                itemRecords: list.items || []
            }
        });
    } catch (err) {
        console.error('Error fetching master list:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch list', error: err.message });
    }
}

// CREATE new list
async function createList(req, res) {
    try {
        const { title, category, description, items } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        const cleanTitle = title.trim();
        const existing = await MasterList.findOne({ where: { title: cleanTitle } });
        if (existing) {
            return res.status(400).json({ success: false, message: `A list named "${cleanTitle}" already exists.` });
        }

        const created = await MasterList.create({
            title: cleanTitle,
            category: category || 'General',
            description: description || ''
        });

        // Insert items if provided
        if (Array.isArray(items) && items.length > 0) {
            const itemRows = items
                .map(it => (typeof it === 'string' ? it.trim() : (it?.itemValue || '').trim()))
                .filter(Boolean)
                .map((val, idx) => ({
                    listId: created.id,
                    itemValue: val,
                    sortOrder: idx + 1
                }));

            if (itemRows.length > 0) {
                await MasterListItem.bulkCreate(itemRows);
            }
        }

        const full = await MasterList.findByPk(created.id, {
            include: [{ model: MasterListItem, as: 'items' }]
        });

        res.status(201).json({
            success: true,
            data: {
                id: full.id,
                title: full.title,
                category: full.category,
                description: full.description,
                items: (full.items || []).map(it => it.itemValue)
            }
        });
    } catch (err) {
        console.error('Error creating master list:', err);
        res.status(500).json({ success: false, message: 'Failed to create list', error: err.message });
    }
}

// UPDATE list
async function updateList(req, res) {
    try {
        const { id } = req.params;
        const { title, category, description, items } = req.body;

        const list = await MasterList.findByPk(id);
        if (!list) {
            return res.status(404).json({ success: false, message: 'List not found' });
        }

        if (title && title.trim()) {
            list.title = title.trim();
        }
        if (category !== undefined) list.category = category;
        if (description !== undefined) list.description = description;
        await list.save();

        // If items array provided, replace child items
        if (Array.isArray(items)) {
            await MasterListItem.destroy({ where: { listId: list.id } });
            const itemRows = items
                .map(it => (typeof it === 'string' ? it.trim() : (it?.itemValue || '').trim()))
                .filter(Boolean)
                .map((val, idx) => ({
                    listId: list.id,
                    itemValue: val,
                    sortOrder: idx + 1
                }));

            if (itemRows.length > 0) {
                await MasterListItem.bulkCreate(itemRows);
            }
        }

        const updated = await MasterList.findByPk(list.id, {
            include: [{ model: MasterListItem, as: 'items' }]
        });

        res.json({
            success: true,
            data: {
                id: updated.id,
                title: updated.title,
                category: updated.category,
                description: updated.description,
                items: (updated.items || []).map(it => it.itemValue)
            }
        });
    } catch (err) {
        console.error('Error updating master list:', err);
        res.status(500).json({ success: false, message: 'Failed to update list', error: err.message });
    }
}

// DELETE list
async function deleteList(req, res) {
    try {
        const { id } = req.params;
        const list = await MasterList.findByPk(id);
        if (!list) {
            return res.status(404).json({ success: false, message: 'List not found' });
        }

        await list.destroy();
        res.json({ success: true, message: `List "${list.title}" deleted successfully.` });
    } catch (err) {
        console.error('Error deleting master list:', err);
        res.status(500).json({ success: false, message: 'Failed to delete list', error: err.message });
    }
}

// SEED INITIAL CONFIGURATION LISTS & ENSURE ESSENTIAL SYSTEM LISTS
async function seedMasterListsIfEmpty() {
    try {
        const defaultHandlers = ['Renuka', 'Daya', 'Sharath', 'K Karthikeyen', 'S Karthikeyen', 'Soundarajan'];

        const essentialLists = [
            {
                title: 'Leads Name',
                category: 'Projects',
                description: 'Sales and marketing leads handlers',
                items: defaultHandlers
            },
            {
                title: 'Call Status',
                category: 'Activity',
                description: 'Lifecycle status options for logging and managing sales & client calls',
                items: ['New Lead', 'Offer-Submission', 'Queries', 'Negotiation', 'Others']
            },
            {
                title: 'Meeting Purpose',
                category: 'Activity',
                description: 'Meeting classification and purpose types',
                items: ['Client', 'All', 'Site Plan', 'Site Visit']
            },
            {
                title: 'Meeting Status',
                category: 'Activity',
                description: 'Schedule and execution statuses for team & client meetings',
                items: ['Scheduled', 'Completed', 'Cancelled']
            },
            {
                title: 'Task Priority',
                category: 'Activity',
                description: 'Priority levels for internal team task delegation',
                items: ['High', 'Medium', 'Low']
            },
            {
                title: 'Task Status',
                category: 'Activity',
                description: 'Progress states for tracked tasks',
                items: ['Pending', 'In Progress', 'Completed']
            },
            {
                title: 'Role / Designation',
                category: 'Office',
                description: 'Designation and professional roles for company employees',
                items: [
                    'Business Development Executive',
                    'Junior Business Development Executive',
                    'Junior Engineer',
                    'Senior Engineer',
                    'Asst. Manager',
                    'General Manager',
                    'Project Manager',
                    'Solar Design Engineer'
                ]
            },
            {
                title: 'Employee Responsibility',
                category: 'Office',
                description: 'Functional departments and responsibilities',
                items: ['Engineers', 'Sales', 'Admin', 'Purchase', 'Accounts & HR', 'Inventory & Stores']
            },
            {
                title: 'Site_Category',
                category: 'Projects',
                description: 'Project and opportunity site category classification',
                items: ['TATA SPG', 'Waree', 'Premier', 'Other']
            },
            {
                title: 'Vendors',
                category: 'Office',
                description: 'Approved vendor suppliers and service contractors for Gate Pass, PO/WO and Inventory',
                items: [
                    '4M SOLAR SOLUTIONS PRIVATE LIMITED',
                    'AADHI ENTERPRISES',
                    'AIM EVENTS',
                    'AISWARYA POWER CORPORATION',
                    'ANIKA ELECTRICALS',
                    'CHEMI TECH CONSTRUCTIONS PVT. LTD',
                    'DEEKAY ELECTRICALS',
                    'DEZERVE SOLAR INDIA PRIVATE LIMITED',
                    'DK ELECTRO AND INDUSTRIAL SOLUTIONS LLP',
                    'DVR POWER ENGINEERING',
                    'EXCEL EARTHING PRIVATE LIMITED',
                    'FESTA SOLAR PRIVATE LIMITED',
                    'FINE LINE ENGINEERS',
                    'FOMRA ELECTRICALS',
                    'GEESYS TECHNOLOGIES INDIA',
                    'GEMINI SOLARISS',
                    'GLOW POWER TECHNOLOGIES',
                    'GRAVIN EARTHING & LIGHTNING PROTECTION',
                    'GREEN ENERGY TRADERS',
                    'GREEN FIELD SOLAR SOLUTION PRIVATE LIMITED',
                    'HIMOUNT POWER SUPPORTS',
                    'HIVESOLAR ENERGY',
                    'IDEAL STRCTURES PVT LTD',
                    'INFINITY SOLAR SOLUTION',
                    'INTEGRATED POWER SYSTEMS',
                    'IPOWER ELECTRIC',
                    'JAISOLAR ENERGY MANAGEMENT SYSTEMS',
                    'LOYYAL BATTERY SERVICE',
                    'MASIMA AUTOMATION SYSTEMS',
                    'OPTIMUM ENERGY SOLAR SYSTEM',
                    'ORBIT SOLAR POWER',
                    'POWERPLUS AGENCIES PVT LTD',
                    'R R CONECTICS',
                    'RADIUS SOLAR WORLD',
                    'SARASWATHI ELECTRICAL SOLAR POWER SYSTEMS',
                    'SEYON ENERGY',
                    'SOLAR MOUNTIN SYSTEM SOLUTIONS',
                    'SOLSTROM ENERGY SOLUTION PVT LTD',
                    'SOUNDARARAJAN M',
                    'SP DESIGN & ENGINEERING',
                    'SPAGTECH SOLUTIONS',
                    'SREE SWASTIK ENERGY',
                    'SS POWER SOLUTIONS',
                    'STREAMTECH ENERGY SOLUTIONS',
                    'SUNAP ECOPOWER PRIVATE LIMITED',
                    'SUNDROPINDIA ENERGY SOLUTIONS',
                    'SUNLIT FUTURE',
                    'TATA POWER RENEWABLE ENERGY LIMITED',
                    'TOUCH AND GLOW',
                    'TRANSFIX INDIA LIMITED',
                    'TRIWIN SOLUTIONS',
                    'UDAYAJIT SOLAR PRIVATE LIMITED',
                    'UNO POWER',
                    'V SHARATH',
                    'VAIRAMANI M',
                    'VARDHAMAN SOLAR SOLUTIONS',
                    'VASHI INTEGRATED SOLUTIONS LTD',
                    'VENKATESWARA SUPPLIERS PVT LTD',
                    'VIRIDIS ENGINEERING INDIA PRIVATE LIMITED',
                    'VRM STRUCTURES INDIA PRIVATE LIMITED'
                ]
            }
        ];

        const ensureEssentialLists = async () => {
            for (const item of essentialLists) {
                let existing = await MasterList.findOne({ where: { title: item.title } });
                if (!existing) {
                    existing = await MasterList.create({
                        title: item.title,
                        category: item.category,
                        description: item.description
                    });
                    const itemRows = item.items.map((val, idx) => ({
                        listId: existing.id,
                        itemValue: val,
                        sortOrder: idx + 1
                    }));
                    await MasterListItem.bulkCreate(itemRows);
                } else {
                    const currentItems = await MasterListItem.findAll({ where: { listId: existing.id } });
                    const currentVals = currentItems.map(it => it.itemValue.toLowerCase().trim());
                    for (let i = 0; i < item.items.length; i++) {
                        const val = item.items[i];
                        if (!currentVals.includes(val.toLowerCase().trim())) {
                            await MasterListItem.create({
                                listId: existing.id,
                                itemValue: val,
                                sortOrder: currentItems.length + i + 1
                            });
                        }
                    }
                }
            }
        };

        const count = await MasterList.count();
        if (count > 0) {
            await ensureEssentialLists();
            return;
        }

        console.log('Seeding initial Master Configuration Lists...');

        const initialLists = [
            {
                title: 'Leads Name',
                category: 'Projects',
                description: 'Sales and marketing leads handlers',
                items: defaultHandlers
            },

            {
                title: 'Materials',
                category: 'Inventory',
                description: 'Complete materials and consumable types for Indent, Warehouse, Gate Pass and Cart',
                items: [
                    'Cable Tray Materials',
                    'Cables',
                    'Civil Work Labour',
                    'Consumables',
                    'DB Boxes',
                    'Earthing Materials',
                    'Expo / Event Expenses',
                    'Labour/Manpower',
                    'Lead Acid Batteries',
                    'Lightning Arrestors',
                    'Lithium Batteries',
                    'Material Transport',
                    'Panles Cleaning Liquid',
                    'Petrol Cliam',
                    'Rental Tools',
                    'Solar CEIG Works',
                    'Solar I&C Works',
                    'Solar Inverters',
                    'Solar Meters',
                    'Solar MMS',
                    'Solar Panels',
                    'TATA SPG Package',
                    'Walkway / Hand Rails',
                    'Zero Export Device',
                    'Tools Asset',
                    'Safety Certificates'
                ]
            },
            {
                title: 'Invoice Type',
                category: 'Billing',
                description: 'Project invoice and billing classification',
                items: [
                    'Material Supply',
                    'I&C Works',
                    'CEIG Documentation',
                    'Supply and I&C work'
                ]
            },
            {
                title: 'Sale_Type',
                category: 'Projects',
                description: 'Commercial contract sale channel',
                items: [
                    'B2C',
                    'Direct B2B',
                    'Retailer B2B'
                ]
            },
            {
                title: 'Client_Type',
                category: 'Projects',
                description: 'Client legal and organizational categorization',
                items: [
                    'Assosiation',
                    'Company',
                    'Govt. Org',
                    'Individual',
                    'Institutional'
                ]
            },
            {
                title: 'Sys_Type',
                category: 'Projects',
                description: 'Solar PV system electrical grid topology',
                items: [
                    'Hybrid',
                    'Off Grid',
                    'On Gird',
                    'Solar Pump'
                ]
            },
            {
                title: 'Site_Type',
                category: 'Projects',
                description: 'Site structural classification',
                items: [
                    'Car Port',
                    'Commercial',
                    'Floating',
                    'Ground Mount',
                    'Industrial',
                    'Residential',
                    'Residential Common'
                ]
            },
            {
                title: 'Site Stage',
                category: 'Projects',
                description: 'Project execution stages',
                items: [
                    'EB Work in Process',
                    'Handed Over',
                    'I&C Completed',
                    'Installation Inprocess',
                    'Material Procurement',
                    'Project Awarded',
                    'Site Commissioned'
                ]
            },
            {
                title: 'Site Status',
                category: 'Projects',
                description: 'High-level site milestone status',
                items: [
                    'Not Started',
                    'Materials Supplied',
                    'I&C Completed',
                    'EB Work in Process',
                    'Site Commissioned',
                    'Handed Over'
                ]
            },
            {
                title: 'Invoice Status',
                category: 'Billing',
                description: 'Project invoice payment billing state',
                items: [
                    'Billed',
                    'Partly Billed',
                    'Not Billed'
                ]
            },
            {
                title: 'Payment Through',
                category: 'Finances',
                description: 'Disbursement instrument for site expenses',
                items: [
                    'P.O',
                    'W.O',
                    'Petty Cash',
                    'Accounts'
                ]
            },
            {
                title: 'Bill / Voucher Status',
                category: 'Finances',
                description: 'Expense voucher verification status',
                items: [
                    'Submitted',
                    'Not Submitted'
                ]
            },
            {
                title: 'Payment Mode',
                category: 'Finances',
                description: 'Banking and remittance payment channels',
                items: [
                    'Bank Transfer / NEFT',
                    'Bank Transfer / IMPS',
                    'Cheque / DD',
                    'UPI',
                    'Bank Deposit'
                ]
            },
            {
                title: 'Payment Purpose',
                category: 'Finances',
                description: 'Designated executive or account for expense disbursements',
                items: [
                    'K SATHISH',
                    'K KARTHIKEYAN',
                    'V SHARATH',
                    'S KARTHIKEYAN',
                    'SOUNDARARAJAN M',
                    'RENUKA S',
                    'MANIMARAN N',
                    'VAIRAMANI',
                    'SAKTHI VEL',
                    'OFFICE',
                    'RAHUL'
                ]
            }
        ];

        for (const list of initialLists) {
            const created = await MasterList.create({
                title: list.title,
                category: list.category,
                description: list.description
            });

            const itemRows = list.items.map((val, idx) => ({
                listId: created.id,
                itemValue: val,
                sortOrder: idx + 1
            }));

            await MasterListItem.bulkCreate(itemRows);
        }

        console.log('Successfully seeded 13 Master Configuration Lists!');
    } catch (err) {
        console.error('Error seeding Master Lists:', err);
    }
}

module.exports = {
    getAllLists,
    getListByTitleOrId,
    createList,
    updateList,
    deleteList,
    seedMasterListsIfEmpty
};
