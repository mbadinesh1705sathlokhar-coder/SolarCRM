const { Op } = require('sequelize');
const { ClientPaymentLedger } = require('../models/ClientPaymentLedger');
const { SiteExpenseLedger } = require('../models/SiteExpenseLedger');
const { ProjectMaster, computeMetrics } = require('../models/ProjectMaster');

// Date conversion helpers
function parseToIsoDate(dateStr) {
    if (!dateStr) return new Date().toISOString().slice(0, 10);
    const trimmed = String(dateStr).trim();
    if (trimmed.includes('-')) {
        const parts = trimmed.split('-');
        if (parts.length === 3) {
            // If dd-mm-yyyy
            if (parts[0].length === 2 && parts[2].length === 4) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            // If yyyy-mm-dd
            if (parts[0].length === 4) {
                return trimmed;
            }
        }
    }
    return trimmed;
}

function formatToDdMmYyyy(isoDateStr) {
    if (!isoDateStr) return '';
    const parts = String(isoDateStr).slice(0, 10).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return isoDateStr;
}

function deriveMoP(dateStr) {
    if (!dateStr) return '';
    const iso = parseToIsoDate(dateStr);
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = months[d.getMonth()];
    const y = String(d.getFullYear()).slice(-2);
    return `${m}-${y}`;
}

// Helper to recalculate and sync ProjectMaster received & due
async function syncProjectReceived(siteId) {
    if (!siteId) return null;
    const cleanSiteId = siteId.replace(/:/g, '').trim();
    const totalRecv = await ClientPaymentLedger.sum('amount', { where: { siteId: cleanSiteId } }) || 0;
    const project = await ProjectMaster.findOne({ where: { siteId: cleanSiteId } });
    if (project) {
        project.received = parseFloat(Number(totalRecv).toFixed(2));
        await project.save();
        return project;
    }
    return null;
}

// Helper to recalculate and sync ProjectMaster siteExpenses & margin
async function syncProjectExpenses(siteId) {
    if (!siteId) return null;
    const cleanSiteId = siteId.replace(/:/g, '').trim();
    const totalExp = await SiteExpenseLedger.sum('amount', { where: { siteId: cleanSiteId } }) || 0;
    const project = await ProjectMaster.findOne({ where: { siteId: cleanSiteId } });
    if (project) {
        project.siteExpenses = parseFloat(Number(totalExp).toFixed(2));
        await project.save();
        return project;
    }
    return null;
}

// --- PAYMENTS CONTROLLER ---

exports.getAllPayments = async (req, res) => {
    try {
        const { search, siteId, paymentMode, mop, startDate, endDate } = req.query;
        const whereClause = {};

        if (siteId) {
            whereClause.siteId = siteId.replace(/:/g, '').trim();
        }

        if (paymentMode && paymentMode !== 'All') {
            const modes = paymentMode.split(',').map(m => m.trim()).filter(Boolean);
            const hasBlanks = modes.includes('(Blanks)');
            const regularModes = modes.filter(m => m !== '(Blanks)');

            if (hasBlanks && regularModes.length > 0) {
                whereClause[Op.or] = [
                    { paymentMode: { [Op.in]: regularModes } },
                    { paymentMode: null },
                    { paymentMode: '' },
                    { paymentMode: '(Blanks)' }
                ];
            } else if (hasBlanks) {
                whereClause[Op.or] = [
                    { paymentMode: null },
                    { paymentMode: '' },
                    { paymentMode: '(Blanks)' }
                ];
            } else if (regularModes.length > 0) {
                whereClause.paymentMode = { [Op.in]: regularModes };
            }
        }

        if (mop && mop !== 'All') {
            const mops = mop.split(',').map(m => m.trim()).filter(Boolean);
            if (mops.length > 0) whereClause.mop = { [Op.in]: mops };
        }

        if (search) {
            whereClause[Op.or] = [
                { siteId: { [Op.like]: `%${search}%` } },
                { clientName: { [Op.like]: `%${search}%` } },
                { clientSiteName: { [Op.like]: `%${search}%` } },
                { paymentMode: { [Op.like]: `%${search}%` } },
                { remarks: { [Op.like]: `%${search}%` } },
                { mop: { [Op.like]: `%${search}%` } },
                { referenceNo: { [Op.like]: `%${search}%` } }
            ];
        }

        if (startDate && endDate) {
            whereClause.paymentDate = { [Op.between]: [parseToIsoDate(startDate), parseToIsoDate(endDate)] };
        } else if (startDate) {
            whereClause.paymentDate = { [Op.gte]: parseToIsoDate(startDate) };
        } else if (endDate) {
            whereClause.paymentDate = { [Op.lte]: parseToIsoDate(endDate) };
        }

        const payments = await ClientPaymentLedger.findAll({
            where: whereClause,
            order: [
                ['paymentDate', 'DESC'],
                ['id', 'DESC']
            ]
        });

        const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        const formatted = payments.map(p => {
            const raw = p.toJSON ? p.toJSON() : p;
            return {
                ...raw,
                formattedDate: formatToDdMmYyyy(raw.paymentDate)
            };
        });

        return res.status(200).json({
            success: true,
            count: formatted.length,
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            data: formatted
        });
    } catch (err) {
        console.error('Error fetching payments:', err);
        return res.status(500).json({ success: false, message: 'Error fetching payment ledger', error: err.message });
    }
};

exports.createPayment = async (req, res) => {
    try {
        const { sNo, mop, paymentDate, clientSiteName, siteId, clientName, amount, paymentMode, remarks, referenceNo } = req.body;

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'A valid positive amount is required.' });
        }

        let cleanSiteId = (siteId || '').replace(/:/g, '').trim();
        let finalClientName = (clientName || '').trim();
        let finalClientSiteName = (clientSiteName || '').trim();

        // Autocomplete siteId from clientName if missing
        if (!cleanSiteId && finalClientName) {
            const matchedProj = await ProjectMaster.findOne({
                where: { clientName: { [Op.like]: `%${finalClientName}%` } }
            });
            if (matchedProj) {
                cleanSiteId = matchedProj.siteId;
                if (!finalClientName) finalClientName = matchedProj.clientName;
            }
        }

        // Autocomplete clientName from siteId if missing
        if (cleanSiteId && !finalClientName) {
            const matchedProj = await ProjectMaster.findOne({ where: { siteId: cleanSiteId } });
            if (matchedProj) {
                finalClientName = matchedProj.clientName;
            }
        }

        if (!cleanSiteId) {
            cleanSiteId = 'UNASSIGNED';
        }

        if (!finalClientName) {
            finalClientName = 'Client ' + cleanSiteId;
        }

        if (!finalClientSiteName) {
            finalClientSiteName = `${cleanSiteId} : ${finalClientName}`;
        }

        const isoDate = parseToIsoDate(paymentDate);
        const finalMoP = mop || deriveMoP(isoDate);

        // Next S.No if not provided
        let nextSNo = sNo;
        if (!nextSNo) {
            const maxRow = await ClientPaymentLedger.findOne({ order: [['sNo', 'DESC']] });
            nextSNo = maxRow && maxRow.sNo ? maxRow.sNo + 1 : 1;
        }

        const newPayment = await ClientPaymentLedger.create({
            sNo: parseInt(nextSNo) || null,
            mop: finalMoP,
            paymentDate: isoDate,
            clientSiteName: finalClientSiteName,
            siteId: cleanSiteId,
            clientName: finalClientName,
            amount: parseFloat(amount),
            paymentMode: paymentMode || 'Bank Transfer / NEFT',
            remarks: remarks || '',
            referenceNo: referenceNo || ''
        });

        // Sync with Project Master
        const updatedProject = await syncProjectReceived(cleanSiteId);

        return res.status(201).json({
            success: true,
            message: 'Payment recorded and project dashboard synchronized successfully.',
            data: {
                ...newPayment.toJSON(),
                formattedDate: formatToDdMmYyyy(newPayment.paymentDate)
            },
            updatedProject: updatedProject ? {
                siteId: updatedProject.siteId,
                clientName: updatedProject.clientName,
                siteValue: updatedProject.siteValue,
                received: updatedProject.received,
                due: computeMetrics(updatedProject).due
            } : null
        });
    } catch (err) {
        console.error('Error creating payment:', err);
        return res.status(500).json({ success: false, message: 'Error creating payment entry', error: err.message });
    }
};

exports.updatePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await ClientPaymentLedger.findByPk(id);
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found.' });
        }

        const oldSiteId = payment.siteId;
        const { sNo, mop, paymentDate, clientSiteName, siteId, clientName, amount, paymentMode, remarks, referenceNo } = req.body;

        let cleanSiteId = siteId ? siteId.replace(/:/g, '').trim() : payment.siteId;
        let finalClientName = clientName !== undefined ? clientName.trim() : payment.clientName;
        let finalClientSiteName = clientSiteName !== undefined ? clientSiteName.trim() : payment.clientSiteName;

        // Autocomplete siteId from clientName if requested
        if (clientName && (!siteId || siteId === payment.siteId)) {
            const matchedProj = await ProjectMaster.findOne({
                where: { clientName: { [Op.like]: `%${finalClientName}%` } }
            });
            if (matchedProj) {
                cleanSiteId = matchedProj.siteId;
            }
        }

        const isoDate = paymentDate !== undefined ? parseToIsoDate(paymentDate) : payment.paymentDate;
        const finalMoP = mop !== undefined ? mop : (paymentDate ? deriveMoP(isoDate) : payment.mop);

        await payment.update({
            sNo: sNo !== undefined ? (parseInt(sNo) || null) : payment.sNo,
            mop: finalMoP,
            paymentDate: isoDate,
            clientSiteName: finalClientSiteName,
            siteId: cleanSiteId,
            clientName: finalClientName,
            amount: amount !== undefined ? parseFloat(amount) : payment.amount,
            paymentMode: paymentMode !== undefined ? paymentMode : payment.paymentMode,
            remarks: remarks !== undefined ? remarks : payment.remarks,
            referenceNo: referenceNo !== undefined ? referenceNo : payment.referenceNo
        });

        // Resync current site
        const updatedProject = await syncProjectReceived(cleanSiteId);

        // If site was changed, also resync old site
        if (oldSiteId && oldSiteId !== cleanSiteId) {
            await syncProjectReceived(oldSiteId);
        }

        return res.status(200).json({
            success: true,
            message: 'Payment updated and dashboard synchronized.',
            data: {
                ...payment.toJSON(),
                formattedDate: formatToDdMmYyyy(payment.paymentDate)
            },
            updatedProject: updatedProject ? {
                siteId: updatedProject.siteId,
                clientName: updatedProject.clientName,
                siteValue: updatedProject.siteValue,
                received: updatedProject.received,
                due: computeMetrics(updatedProject).due
            } : null
        });
    } catch (err) {
        console.error('Error updating payment:', err);
        return res.status(500).json({ success: false, message: 'Error updating payment', error: err.message });
    }
};

exports.deletePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await ClientPaymentLedger.findByPk(id);
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found.' });
        }

        const siteId = payment.siteId;
        await payment.destroy();

        // Resync project master
        const updatedProject = await syncProjectReceived(siteId);

        return res.status(200).json({
            success: true,
            message: 'Payment deleted and dashboard synchronized.',
            updatedProject: updatedProject ? {
                siteId: updatedProject.siteId,
                received: updatedProject.received,
                due: computeMetrics(updatedProject).due
            } : null
        });
    } catch (err) {
        console.error('Error deleting payment:', err);
        return res.status(500).json({ success: false, message: 'Error deleting payment', error: err.message });
    }
};

exports.deletePaymentsBySiteId = async (req, res) => {
    try {
        const { siteId } = req.params;
        const cleanSiteId = (siteId || '').replace(/:/g, '').trim();

        await ClientPaymentLedger.destroy({
            where: { siteId: cleanSiteId }
        });

        // Resync project master
        const updatedProject = await syncProjectReceived(cleanSiteId);

        return res.status(200).json({
            success: true,
            message: `All payments for site ${cleanSiteId} removed and dashboard balance recalculated.`,
            updatedProject: updatedProject ? {
                siteId: updatedProject.siteId,
                received: updatedProject.received,
                due: computeMetrics(updatedProject).due
            } : null
        });
    } catch (err) {
        console.error('Error deleting payments for site:', err);
        return res.status(500).json({ success: false, message: 'Error deleting payments for site', error: err.message });
    }
};

// --- EXPENSES CONTROLLER ---

exports.getAllExpenses = async (req, res) => {
    try {
        const { search, siteId, mop, paymentThrough, purpose, paidBy, billVoucher, startDate, endDate } = req.query;
        const whereClause = {};

        if (siteId) {
            whereClause.siteId = siteId.replace(/:/g, '').trim();
        }

        // Helper for multi-select with blanks
        const applyMultiFilter = (paramVal, fieldName) => {
            if (!paramVal || paramVal === 'All') return;
            const items = paramVal.split(',').map(m => m.trim()).filter(Boolean);
            const hasBlanks = items.includes('(Blanks)');
            const regularItems = items.filter(m => m !== '(Blanks)');

            if (hasBlanks && regularItems.length > 0) {
                whereClause[Op.or] = whereClause[Op.or] || [];
                whereClause[Op.or].push(
                    { [fieldName]: { [Op.in]: regularItems } },
                    { [fieldName]: null },
                    { [fieldName]: '' },
                    { [fieldName]: '(Blanks)' }
                );
            } else if (hasBlanks) {
                whereClause[Op.or] = whereClause[Op.or] || [];
                whereClause[Op.or].push(
                    { [fieldName]: null },
                    { [fieldName]: '' },
                    { [fieldName]: '(Blanks)' }
                );
            } else if (regularItems.length > 0) {
                whereClause[fieldName] = { [Op.in]: regularItems };
            }
        };

        applyMultiFilter(paymentThrough, 'paymentThrough');
        applyMultiFilter(purpose, 'purpose');
        applyMultiFilter(paidBy, 'paidBy');
        applyMultiFilter(billVoucher, 'billVoucher');

        if (mop && mop !== 'All') {
            const mops = mop.split(',').map(m => m.trim()).filter(Boolean);
            if (mops.length > 0) whereClause.mop = { [Op.in]: mops };
        }

        if (search) {
            const searchConditions = [
                { siteId: { [Op.like]: `%${search}%` } },
                { clientName: { [Op.like]: `%${search}%` } },
                { clientSiteName: { [Op.like]: `%${search}%` } },
                { purpose: { [Op.like]: `%${search}%` } },
                { paymentThrough: { [Op.like]: `%${search}%` } },
                { paidBy: { [Op.like]: `%${search}%` } },
                { remarks: { [Op.like]: `%${search}%` } },
                { mop: { [Op.like]: `%${search}%` } },
                { billVoucher: { [Op.like]: `%${search}%` } },
                { vendorName: { [Op.like]: `%${search}%` } }
            ];

            if (whereClause[Op.or]) {
                whereClause[Op.and] = [
                    { [Op.or]: whereClause[Op.or] },
                    { [Op.or]: searchConditions }
                ];
                delete whereClause[Op.or];
            } else {
                whereClause[Op.or] = searchConditions;
            }
        }

        if (startDate && endDate) {
            whereClause.expenseDate = { [Op.between]: [parseToIsoDate(startDate), parseToIsoDate(endDate)] };
        } else if (startDate) {
            whereClause.expenseDate = { [Op.gte]: parseToIsoDate(startDate) };
        } else if (endDate) {
            whereClause.expenseDate = { [Op.lte]: parseToIsoDate(endDate) };
        }

        const expenses = await SiteExpenseLedger.findAll({
            where: whereClause,
            order: [
                ['expenseDate', 'DESC'],
                ['id', 'DESC']
            ]
        });

        const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const formatted = expenses.map(e => {
            const raw = e.toJSON ? e.toJSON() : e;
            return {
                ...raw,
                formattedDate: formatToDdMmYyyy(raw.expenseDate)
            };
        });

        return res.status(200).json({
            success: true,
            count: formatted.length,
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            data: formatted
        });
    } catch (err) {
        console.error('Error fetching expenses:', err);
        return res.status(500).json({ success: false, message: 'Error fetching expense ledger', error: err.message });
    }
};

exports.createExpense = async (req, res) => {
    try {
        const { sNo, mop, siteId, clientSiteName, clientName, expenseDate, amount, paymentThrough, purpose, paidBy, remarks, billVoucher, invoiceNo, claimStatus, paymentNote, vendorName, vendor } = req.body;

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'A valid positive amount is required.' });
        }

        let cleanSiteId = (siteId || '').replace(/:/g, '').trim();
        let finalClientName = (clientName || '').trim();
        let finalClientSiteName = (clientSiteName || '').trim();

        // Autocomplete siteId from clientName
        if (!cleanSiteId && finalClientName) {
            const matchedProj = await ProjectMaster.findOne({
                where: { clientName: { [Op.like]: `%${finalClientName}%` } }
            });
            if (matchedProj) {
                cleanSiteId = matchedProj.siteId;
                if (!finalClientSiteName) {
                    finalClientSiteName = `${cleanSiteId} : ${matchedProj.siteCapacity}KW, ${matchedProj.clientName}, ${matchedProj.location}`;
                }
            }
        }

        // Autocomplete clientName from siteId
        if (cleanSiteId && !finalClientName) {
            const matchedProj = await ProjectMaster.findOne({ where: { siteId: cleanSiteId } });
            if (matchedProj) {
                finalClientName = matchedProj.clientName;
                if (!finalClientSiteName) {
                    finalClientSiteName = `${cleanSiteId} : ${matchedProj.siteCapacity}KW, ${matchedProj.clientName}, ${matchedProj.location}`;
                }
            }
        }

        const isoDate = parseToIsoDate(expenseDate);
        const finalMoP = mop || deriveMoP(isoDate);
        const finalVendor = (vendorName || vendor || '').trim();

        const newExpense = await SiteExpenseLedger.create({
            sNo: sNo ? parseInt(sNo) : null,
            mop: finalMoP,
            expenseDate: isoDate,
            siteId: cleanSiteId || 'UNASSIGNED',
            clientSiteName: finalClientSiteName || cleanSiteId,
            clientName: finalClientName || 'Client ' + cleanSiteId,
            amount: parseFloat(amount),
            paymentThrough: paymentThrough || 'Petty Cash',
            purpose: purpose || 'Consumables',
            paidBy: paidBy || 'OFFICE',
            remarks: remarks || '',
            billVoucher: billVoucher || 'Not Submitted',
            invoiceNo: invoiceNo || '',
            claimStatus: claimStatus || '',
            paymentNote: paymentNote || '',
            category: purpose || 'Materials Supply',
            vendorName: finalVendor,
            description: remarks || '',
            referenceNo: invoiceNo || paymentThrough || ''
        });

        // Sync with Project Master
        const updatedProject = await syncProjectExpenses(cleanSiteId);

        return res.status(201).json({
            success: true,
            message: 'Expense recorded and project dashboard synchronized successfully.',
            data: {
                ...newExpense.toJSON(),
                formattedDate: formatToDdMmYyyy(newExpense.expenseDate)
            },
            updatedProject: updatedProject ? {
                siteId: updatedProject.siteId,
                clientName: updatedProject.clientName,
                siteValue: updatedProject.siteValue,
                siteExpenses: updatedProject.siteExpenses,
                margin: computeMetrics(updatedProject).margin,
                marginPercentage: computeMetrics(updatedProject).marginPercentage
            } : null
        });
    } catch (err) {
        console.error('Error creating expense:', err);
        return res.status(500).json({ success: false, message: 'Error creating expense entry', error: err.message });
    }
};

exports.updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const expense = await SiteExpenseLedger.findByPk(id);
        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense record not found.' });
        }

        const oldSiteId = expense.siteId;
        const { sNo, mop, siteId, clientSiteName, clientName, expenseDate, amount, paymentThrough, purpose, paidBy, remarks, billVoucher, invoiceNo, claimStatus, paymentNote, vendorName, vendor } = req.body;

        let cleanSiteId = siteId ? siteId.replace(/:/g, '').trim() : expense.siteId;
        let finalClientName = clientName !== undefined ? clientName.trim() : expense.clientName;
        let finalClientSiteName = clientSiteName !== undefined ? clientSiteName.trim() : expense.clientSiteName;

        if (clientName && (!siteId || siteId === expense.siteId)) {
            const matchedProj = await ProjectMaster.findOne({
                where: { clientName: { [Op.like]: `%${finalClientName}%` } }
            });
            if (matchedProj) {
                cleanSiteId = matchedProj.siteId;
            }
        }

        const isoDate = expenseDate !== undefined ? parseToIsoDate(expenseDate) : expense.expenseDate;
        const finalMoP = mop !== undefined ? mop : (expenseDate ? deriveMoP(isoDate) : expense.mop);
        const resolvedVendor = vendorName !== undefined ? vendorName : (vendor !== undefined ? vendor : expense.vendorName);

        await expense.update({
            sNo: sNo !== undefined ? (parseInt(sNo) || null) : expense.sNo,
            mop: finalMoP,
            expenseDate: isoDate,
            siteId: cleanSiteId,
            clientSiteName: finalClientSiteName,
            clientName: finalClientName,
            amount: amount !== undefined ? parseFloat(amount) : expense.amount,
            paymentThrough: paymentThrough !== undefined ? paymentThrough : expense.paymentThrough,
            purpose: purpose !== undefined ? purpose : expense.purpose,
            paidBy: paidBy !== undefined ? paidBy : expense.paidBy,
            remarks: remarks !== undefined ? remarks : expense.remarks,
            billVoucher: billVoucher !== undefined ? billVoucher : expense.billVoucher,
            invoiceNo: invoiceNo !== undefined ? invoiceNo : expense.invoiceNo,
            claimStatus: claimStatus !== undefined ? claimStatus : expense.claimStatus,
            paymentNote: paymentNote !== undefined ? paymentNote : expense.paymentNote,
            category: purpose !== undefined ? purpose : expense.category,
            vendorName: resolvedVendor !== undefined ? (resolvedVendor || '').trim() : expense.vendorName,
            description: remarks !== undefined ? remarks : expense.description
        });

        const updatedProject = await syncProjectExpenses(cleanSiteId);
        if (oldSiteId && oldSiteId !== cleanSiteId) {
            await syncProjectExpenses(oldSiteId);
        }

        return res.status(200).json({
            success: true,
            message: 'Expense updated and dashboard synchronized.',
            data: {
                ...expense.toJSON(),
                formattedDate: formatToDdMmYyyy(expense.expenseDate)
            },
            updatedProject: updatedProject ? {
                siteId: updatedProject.siteId,
                clientName: updatedProject.clientName,
                siteValue: updatedProject.siteValue,
                siteExpenses: updatedProject.siteExpenses,
                margin: computeMetrics(updatedProject).margin,
                marginPercentage: computeMetrics(updatedProject).marginPercentage
            } : null
        });
    } catch (err) {
        console.error('Error updating expense:', err);
        return res.status(500).json({ success: false, message: 'Error updating expense', error: err.message });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const expense = await SiteExpenseLedger.findByPk(id);
        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense record not found.' });
        }

        const siteId = expense.siteId;
        await expense.destroy();

        // Resync project master
        const updatedProject = await syncProjectExpenses(siteId);

        return res.status(200).json({
            success: true,
            message: 'Expense deleted and dashboard synchronized.',
            updatedProject: updatedProject ? {
                siteId: updatedProject.siteId,
                siteExpenses: updatedProject.siteExpenses,
                margin: computeMetrics(updatedProject).margin,
                marginPercentage: computeMetrics(updatedProject).marginPercentage
            } : null
        });
    } catch (err) {
        console.error('Error deleting expense:', err);
        return res.status(500).json({ success: false, message: 'Error deleting expense', error: err.message });
    }
};

exports.deleteExpensesBySiteId = async (req, res) => {
    try {
        const { siteId } = req.params;
        const cleanSiteId = (siteId || '').replace(/:/g, '').trim();

        await SiteExpenseLedger.destroy({
            where: { siteId: cleanSiteId }
        });

        // Resync project master
        const updatedProject = await syncProjectExpenses(cleanSiteId);

        return res.status(200).json({
            success: true,
            message: `All expenses for site ${cleanSiteId} removed and dashboard balance recalculated.`,
            updatedProject: updatedProject ? {
                siteId: updatedProject.siteId,
                siteExpenses: updatedProject.siteExpenses,
                margin: computeMetrics(updatedProject).margin,
                marginPercentage: computeMetrics(updatedProject).marginPercentage
            } : null
        });
    } catch (err) {
        console.error('Error deleting expenses for site:', err);
        return res.status(500).json({ success: false, message: 'Error deleting expenses for site', error: err.message });
    }
};

