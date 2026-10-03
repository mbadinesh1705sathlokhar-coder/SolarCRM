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

        const existing = await ProjectMaster.findOne({ where: { siteId } });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Project with Site ID "${siteId}" already exists.`
            });
        }

        const newProject = await ProjectMaster.create({
            awardedDate: awardedDate || null,
            siteId,
            clientName,
            location: location || '',
            contactNo: contactNo || '',
            emailId: emailId || '',
            address: address || '',
            siteCapacity: siteCapacity || '',
            siteValue: parseFloat(siteValue) || 0.00,
            siteType: siteType || 'Commercial',
            systemType: systemType || 'Waaree',
            siteCategory: siteCategory || 'Rooftop',
            clientType: clientType || 'Company',
            saleType: saleType || 'Direct Sale',
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
