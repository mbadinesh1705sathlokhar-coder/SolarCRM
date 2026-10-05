const { Op } = require('sequelize');
const { ProjectMaster, computeMetrics } = require('../models/ProjectMaster');

function formatToDdMmYyyy(isoDateStr) {
    if (!isoDateStr) return '';
    const parts = String(isoDateStr).slice(0, 10).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return isoDateStr;
}

// Format project object with calculated fields
function formatProject(projectInstance) {
    const raw = projectInstance.toJSON ? projectInstance.toJSON() : projectInstance;
    let siteVal = parseFloat(raw.siteValue) || 0;
    const cleanId = (raw.siteId || '').replace(/:/g, '').trim().toUpperCase();
    const spMatch = cleanId.match(/^SP\d+/i);
    const spKey = spMatch ? spMatch[0].toUpperCase() : cleanId;

    const knownMap = {
        'SP427': 242635,
        'SP426': 230000,
        'SP425': 230000,
        'SP424': 150000,
        'SP423': 335194,
        'SP422': 215000,
        'SP421': 186872,
        'SP420': 200000,
        'SP419': 300000
    };

    if (siteVal === 0) {
        if (knownMap[spKey]) {
            siteVal = knownMap[spKey];
            raw.siteValue = siteVal;
        } else if ((parseFloat(raw.received) || 0) > 0) {
            siteVal = parseFloat(raw.received) || 0;
            raw.siteValue = siteVal;
        }
    }

    const metrics = computeMetrics(raw);
    let parsedBom = [];
    if (raw.bomItems) {
        if (typeof raw.bomItems === 'string') {
            try { parsedBom = JSON.parse(raw.bomItems); } catch(e) { parsedBom = []; }
        } else if (Array.isArray(raw.bomItems)) {
            parsedBom = raw.bomItems;
        }
    }
    return {
        ...raw,
        siteValue: siteVal,
        ...metrics,
        bomItems: parsedBom,
        formattedAwardedDate: formatToDdMmYyyy(raw.awardedDate)
    };
}

// Get all projects with optional search and filters
exports.getAllProjects = async (req, res) => {
    try {
        const { search, siteType, systemType, clientType, orderBy } = req.query;
        const whereClause = {
            siteId: { [Op.ne]: 'WAREHOUSE' },
            clientName: { [Op.notLike]: '%Warehouse%' }
        };

        if (search) {
            whereClause[Op.or] = [
                { siteId: { [Op.like]: `%${search}%` } },
                { clientName: { [Op.like]: `%${search}%` } },
                { location: { [Op.like]: `%${search}%` } },
                { contactNo: { [Op.like]: `%${search}%` } },
                { emailId: { [Op.like]: `%${search}%` } }
            ];
        }

        if (siteType && siteType !== 'All') {
            const types = siteType.split(',').filter(Boolean);
            if (types.length > 0) whereClause.siteType = { [Op.in]: types };
        }

        if (systemType && systemType !== 'All') {
            const types = systemType.split(',').filter(Boolean);
            if (types.length > 0) whereClause.systemType = { [Op.in]: types };
        }

        if (clientType && clientType !== 'All') {
            const types = clientType.split(',').filter(Boolean);
            if (types.length > 0) whereClause.clientType = { [Op.in]: types };
        }

        if (orderBy && orderBy !== 'All') {
            const orders = orderBy.split(',').filter(Boolean);
            if (orders.length > 0) whereClause.orderBy = { [Op.in]: orders };
        }

        const projects = await ProjectMaster.findAll({
            where: whereClause,
            order: [['id', 'DESC']]
        });

        const formatted = projects.map(formatProject);

        // Sort projects by Site ID descending (numerical large to small: SP419 > SP298 > SP295 > SP242...)
        formatted.sort((a, b) => {
            const idA = a.siteId || '';
            const idB = b.siteId || '';
            const matchA = idA.match(/\d+/);
            const matchB = idB.match(/\d+/);
            const numA = matchA ? parseInt(matchA[0], 10) : NaN;
            const numB = matchB ? parseInt(matchB[0], 10) : NaN;

            if (!isNaN(numA) && !isNaN(numB)) {
                if (numA !== numB) return numB - numA;
            }
            return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
        });

        return res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted
        });
    } catch (err) {
        console.error('Error fetching projects:', err);
        return res.status(500).json({ success: false, message: 'Server error fetching projects', error: err.message });
    }
};

// Get single project
exports.getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await ProjectMaster.findByPk(id);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        return res.status(200).json({ success: true, data: formatProject(project) });
    } catch (err) {
        console.error('Error fetching project:', err);
        return res.status(500).json({ success: false, message: 'Server error fetching project', error: err.message });
    }
};

function normalizeDateString(dateVal) {
    if (!dateVal) return null;
    if (dateVal instanceof Date) {
        if (isNaN(dateVal.getTime())) return null;
        const yyyy = dateVal.getFullYear();
        const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
        const dd = String(dateVal.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    if (typeof dateVal === 'number' || (typeof dateVal === 'string' && /^\d{5}(\.\d+)?$/.test(dateVal.trim()))) {
        const num = typeof dateVal === 'number' ? dateVal : parseFloat(dateVal.trim());
        if (num > 10000 && num < 100000) {
            const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
            if (!isNaN(jsDate.getTime())) {
                const yyyy = jsDate.getUTCFullYear();
                const mm = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(jsDate.getUTCDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
        }
    }

    const str = String(dateVal).trim().replace(/[T\s].*$/, '');
    if (!str) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }

    if (str.includes('-') || str.includes('/') || str.includes('.')) {
        const isSlash = str.includes('/');
        const parts = str.split(/[-/.]/).map(p => p.trim());

        if (parts.length === 3) {
            let p0 = parseInt(parts[0], 10);
            let p1 = parseInt(parts[1], 10);
            let p2 = parseInt(parts[2], 10);

            if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
                let year = p2;
                let month = 0;
                let day = 0;

                if (p0 > 1000) {
                    year = p0;
                    if (p1 > 12) { month = p2; day = p1; }
                    else { month = p1; day = p2; }
                } else {
                    if (year < 100) year += 2000;

                    if (isSlash) {
                        // Slash format default: MM/DD/YYYY (US format e.g. 7/31/2026, 4/13/2026)
                        if (p0 > 12 && p1 <= 12) {
                            day = p0;
                            month = p1;
                        } else {
                            month = p0;
                            day = p1;
                        }
                    } else {
                        // Dash / Dot format default: DD-MM-YYYY (Indian format e.g. 04-10-2026, 04-09-2026)
                        if (p1 > 12 && p0 <= 12) {
                            month = p0;
                            day = p1;
                        } else {
                            day = p0;
                            month = p1;
                        }
                    }
                }

                if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                    const yStr = String(year);
                    const mStr = String(month).padStart(2, '0');
                    const dStr = String(day).padStart(2, '0');
                    return `${yStr}-${mStr}-${dStr}`;
                }
            }
        }
    }

    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
        const yyyy = dObj.getFullYear();
        const mm = String(dObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dObj.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    return null;
}

// Create new project
exports.createProject = async (req, res) => {
    try {
        const {
            awardedDate,
            siteId,
            clientName,
            location,
            contactNo,
            emailId,
            address,
            siteCapacity,
            siteValue,
            siteType,
            systemType,
            siteCategory,
            clientType,
            saleType,
            orderBy,
            received,
            siteExpenses,
            materialsSupply,
            installation,
            ebProcess,
            documents,
            warranty,
            handedOver,
            bomItems
        } = req.body;

        if (!siteId || !clientName) {
            return res.status(400).json({
                success: false,
                message: 'Site ID and Client Name are required fields.'
            });
        }

        const validAwardedDate = normalizeDateString(awardedDate);

        let rawClean = (siteId || '').replace(/:/g, '').trim();
        let spMatch = rawClean.match(/^SP\d+/i);
        let cleanSiteId = spMatch ? spMatch[0].toUpperCase() : rawClean;

        let project = await ProjectMaster.findOne({
            where: {
                [Op.or]: [
                    { siteId: siteId },
                    { siteId: rawClean },
                    { siteId: cleanSiteId }
                ]
            }
        });

        if (project) {
            const inputVal = parseFloat(siteValue);
            const finalSiteValue = (!isNaN(inputVal) && inputVal > 0) ? inputVal : project.siteValue;

            await project.update({
                awardedDate: validAwardedDate || project.awardedDate,
                clientName: clientName || project.clientName,
                location: location !== undefined && location !== '' ? location : project.location,
                contactNo: contactNo !== undefined && contactNo !== '' ? contactNo : project.contactNo,
                emailId: emailId !== undefined && emailId !== '' ? emailId : project.emailId,
                address: address !== undefined && address !== '' ? address : project.address,
                siteCapacity: siteCapacity !== undefined && siteCapacity !== '' ? siteCapacity : project.siteCapacity,
                siteValue: finalSiteValue,
                siteType: siteType || project.siteType,
                systemType: systemType || project.systemType,
                siteCategory: siteCategory || project.siteCategory,
                clientType: clientType || project.clientType,
                saleType: saleType || project.saleType,
                orderBy: orderBy || project.orderBy,
                received: received !== undefined && received !== null ? parseFloat(received) : project.received,
                siteExpenses: siteExpenses !== undefined && siteExpenses !== null ? parseFloat(siteExpenses) : project.siteExpenses,
                materialsSupply: materialsSupply !== undefined ? Boolean(materialsSupply) : project.materialsSupply,
                installation: installation !== undefined ? Boolean(installation) : project.installation,
                ebProcess: ebProcess !== undefined ? Boolean(ebProcess) : project.ebProcess,
                documents: documents !== undefined ? Boolean(documents) : project.documents,
                warranty: warranty !== undefined ? Boolean(warranty) : project.warranty,
                handedOver: handedOver !== undefined ? Boolean(handedOver) : project.handedOver,
                bomItems: bomItems !== undefined ? (typeof bomItems === 'string' ? bomItems : JSON.stringify(bomItems)) : project.bomItems
            });

            return res.status(200).json({
                success: true,
                message: 'Project updated successfully',
                data: formatProject(project)
            });
        }

        const newProject = await ProjectMaster.create({
            awardedDate: validAwardedDate || null,
            siteId,
            clientName,
            location: location || '',
            contactNo: contactNo || '',
            emailId: emailId || '',
            address: address || '',
            siteCapacity: siteCapacity || '',
            siteValue: parseFloat(siteValue) || 0.00,
            siteType: siteType || 'Residential',
            systemType: systemType || 'Ongrid',
            siteCategory: siteCategory || 'TATA SPG',
            clientType: clientType || 'Individual',
            saleType: saleType || 'B2C',
            orderBy: orderBy || '',
            received: parseFloat(received) || 0.00,
            siteExpenses: parseFloat(siteExpenses) || 0.00,
            materialsSupply: Boolean(materialsSupply),
            installation: Boolean(installation),
            ebProcess: Boolean(ebProcess),
            documents: Boolean(documents),
            warranty: Boolean(warranty),
            handedOver: Boolean(handedOver),
            bomItems: bomItems !== undefined ? (typeof bomItems === 'string' ? bomItems : JSON.stringify(bomItems)) : null
        });

        return res.status(201).json({
            success: true,
            message: 'Project created successfully',
            data: formatProject(newProject)
        });
    } catch (err) {
        console.error('Error creating project:', err);
        return res.status(500).json({ success: false, message: 'Server error creating project', error: err.message });
    }
};

// Update project
exports.updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await ProjectMaster.findByPk(id);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        const {
            awardedDate,
            siteId,
            clientName,
            location,
            contactNo,
            emailId,
            address,
            siteCapacity,
            siteValue,
            siteType,
            systemType,
            siteCategory,
            clientType,
            saleType,
            orderBy,
            received,
            siteExpenses,
            materialsSupply,
            installation,
            ebProcess,
            documents,
            warranty,
            handedOver,
            bomItems
        } = req.body;

        if (siteId && siteId !== project.siteId) {
            const existing = await ProjectMaster.findOne({ where: { siteId } });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: `Another project with Site ID "${siteId}" already exists.`
                });
            }
        }

        await project.update({
            awardedDate: awardedDate !== undefined ? (awardedDate || null) : project.awardedDate,
            siteId: siteId !== undefined ? siteId : project.siteId,
            clientName: clientName !== undefined ? clientName : project.clientName,
            location: location !== undefined ? location : project.location,
            contactNo: contactNo !== undefined ? contactNo : project.contactNo,
            emailId: emailId !== undefined ? emailId : project.emailId,
            address: address !== undefined ? address : project.address,
            siteCapacity: siteCapacity !== undefined ? siteCapacity : project.siteCapacity,
            siteValue: siteValue !== undefined ? (parseFloat(siteValue) || 0) : project.siteValue,
            siteType: siteType !== undefined ? siteType : project.siteType,
            systemType: systemType !== undefined ? systemType : project.systemType,
            siteCategory: siteCategory !== undefined ? siteCategory : project.siteCategory,
            clientType: clientType !== undefined ? clientType : project.clientType,
            saleType: saleType !== undefined ? saleType : project.saleType,
            orderBy: orderBy !== undefined ? orderBy : project.orderBy,
            received: project.received,
            siteExpenses: project.siteExpenses,
            materialsSupply: materialsSupply !== undefined ? Boolean(materialsSupply) : project.materialsSupply,
            installation: installation !== undefined ? Boolean(installation) : project.installation,
            ebProcess: ebProcess !== undefined ? Boolean(ebProcess) : project.ebProcess,
            documents: documents !== undefined ? Boolean(documents) : project.documents,
            warranty: warranty !== undefined ? Boolean(warranty) : project.warranty,
            handedOver: handedOver !== undefined ? Boolean(handedOver) : project.handedOver,
            bomItems: bomItems !== undefined ? (typeof bomItems === 'string' ? bomItems : JSON.stringify(bomItems)) : project.bomItems
        });

        return res.status(200).json({
            success: true,
            message: 'Project updated successfully',
            data: formatProject(project)
        });
    } catch (err) {
        console.error('Error updating project:', err);
        return res.status(500).json({ success: false, message: 'Server error updating project', error: err.message });
    }
};

// Quick toggle milestone checkbox
exports.toggleMilestone = async (req, res) => {
    try {
        const { id } = req.params;
        const { field, value } = req.body;

        const allowedFields = [
            'materialsSupply',
            'installation',
            'ebProcess',
            'documents',
            'warranty',
            'handedOver'
        ];

        if (!allowedFields.includes(field)) {
            return res.status(400).json({
                success: false,
                message: `Invalid milestone field "${field}". Allowed: ${allowedFields.join(', ')}`
            });
        }

        const project = await ProjectMaster.findByPk(id);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        const newValue = value !== undefined ? Boolean(value) : !project[field];
        await project.update({ [field]: newValue });

        return res.status(200).json({
            success: true,
            message: `Milestone ${field} updated to ${newValue}`,
            data: formatProject(project)
        });
    } catch (err) {
        console.error('Error toggling milestone:', err);
        return res.status(500).json({ success: false, message: 'Server error toggling milestone', error: err.message });
    }
};

// Delete project
exports.deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await ProjectMaster.findByPk(id);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        await project.destroy();
        return res.status(200).json({ success: true, message: 'Project deleted successfully' });
    } catch (err) {
        console.error('Error deleting project:', err);
        return res.status(500).json({ success: false, message: 'Server error deleting project', error: err.message });
    }
};

// Summary metrics (KPIs)
exports.getSummaryMetrics = async (req, res) => {
    try {
        const projects = await ProjectMaster.findAll({
            where: {
                siteId: { [Op.ne]: 'WAREHOUSE' },
                clientName: { [Op.notLike]: '%Warehouse%' }
            }
        });
        const formatted = projects.map(formatProject);

        const totalProjects = formatted.length;
        const totalSiteValue = formatted.reduce((acc, p) => acc + (parseFloat(p.siteValue) || 0), 0);
        const totalReceived = formatted.reduce((acc, p) => acc + (parseFloat(p.received) || 0), 0);
        const totalDue = formatted.reduce((acc, p) => acc + (parseFloat(p.due) || 0), 0);
        const totalExpenses = formatted.reduce((acc, p) => acc + (parseFloat(p.siteExpenses) || 0), 0);
        const totalMargin = formatted.reduce((acc, p) => acc + (parseFloat(p.margin) || 0), 0);

        const avgCompleted = totalProjects > 0
            ? parseFloat((formatted.reduce((acc, p) => acc + p.completedPercentage, 0) / totalProjects).toFixed(2))
            : 0;

        const avgWip = totalProjects > 0
            ? parseFloat((formatted.reduce((acc, p) => acc + p.workInProgressPercentage, 0) / totalProjects).toFixed(2))
            : 0;

        const completedCount = formatted.filter(p => p.completedPercentage === 100).length;
        const wipCount = formatted.filter(p => p.completedPercentage < 100).length;

        return res.status(200).json({
            success: true,
            data: {
                totalProjects,
                totalSiteValue: parseFloat(totalSiteValue.toFixed(2)),
                totalReceived: parseFloat(totalReceived.toFixed(2)),
                totalDue: parseFloat(totalDue.toFixed(2)),
                totalExpenses: parseFloat(totalExpenses.toFixed(2)),
                totalMargin: parseFloat(totalMargin.toFixed(2)),
                avgCompletedPercentage: avgCompleted,
                avgWipPercentage: avgWip,
                completedCount,
                wipCount
            }
        });
    } catch (err) {
        console.error('Error calculating summary metrics:', err);
        return res.status(500).json({ success: false, message: 'Server error calculating metrics', error: err.message });
    }
};
