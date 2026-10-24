const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ClientPaymentLedger } = require('../models/ClientPaymentLedger');
const { SiteExpenseLedger } = require('../models/SiteExpenseLedger');
const { ProjectMaster, computeMetrics } = require('../models/ProjectMaster');
const { OfficeVendor } = require('../models/OfficeVendor');
const { VendorPoWo } = require('../models/VendorPoWo');

// Date conversion helpers
function parseToIsoDate(dateStr) {
    if (!dateStr) return new Date().toISOString().slice(0, 10);
    if (dateStr instanceof Date) {
        if (isNaN(dateStr.getTime())) return new Date().toISOString().slice(0, 10);
        const yyyy = dateStr.getFullYear();
        const mm = String(dateStr.getMonth() + 1).padStart(2, '0');
        const dd = String(dateStr.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    if (typeof dateStr === 'number' || (typeof dateStr === 'string' && /^\d{5}(\.\d+)?$/.test(dateStr.trim()))) {
        const num = typeof dateStr === 'number' ? dateStr : parseFloat(dateStr.trim());
        if (num > 10000 && num < 100000) {
            const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
            if (!isNaN(jsDate.getTime())) {
                const yyyy = jsDate.getUTCFullYear();
                let m = jsDate.getUTCMonth() + 1;
                let d = jsDate.getUTCDate();
                if (d <= 12) {
                    const temp = m;
                    m = d;
                    d = temp;
                }
                const mm = String(m).padStart(2, '0');
                const dd = String(d).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
        }
    }

    const str = String(dateStr).trim().replace(/[T\s].*$/, '');
    if (!str) return new Date().toISOString().slice(0, 10);

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }

    if (str.includes('-') || str.includes('/') || str.includes('.')) {
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

                    // Always default to DD-MM-YYYY / DD/MM/YYYY (Indian format)
                    if (p1 > 12 && p0 <= 12) {
                        month = p0;
                        day = p1;
                    } else {
                        day = p0;
                        month = p1;
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

    return new Date().toISOString().slice(0, 10);
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

// Helper to resolve canonical siteId, clientName, and clientSiteName against ProjectMaster
async function resolveProjectSiteId(siteId, clientName, clientSiteName) {
    const rawSite = String(siteId || '').trim();
    const rawClientSite = String(clientSiteName || '').trim();
    const rawClient = String(clientName || '').trim();
    const rawInput = `${rawSite} ${rawClientSite} ${rawClient}`.trim();
    if (!rawInput) return { siteId: 'UNASSIGNED', clientName: 'General', clientSiteName: 'UNASSIGNED' };

    // Extract SP code prioritizing siteId first, then clientSiteName, then clientName
    const spMatch = rawSite.match(/SP[-_\s]*(\d+)/i) || rawClientSite.match(/SP[-_\s]*(\d+)/i) || rawClient.match(/SP[-_\s]*(\d+)/i);
    let targetSp = null;
    if (spMatch) {
        targetSp = `SP${spMatch[1]}`;
    }

    let matchedProj = null;
    if (targetSp) {
        matchedProj = await ProjectMaster.findOne({
            where: {
                [Op.or]: [
                    { siteId: targetSp },
                    { siteId: { [Op.like]: `${targetSp} %` } },
                    { siteId: { [Op.like]: `${targetSp}:%` } }
                ]
            }
        });
    }

    if (!matchedProj && !targetSp && rawSite && !rawSite.startsWith('#')) {
        const cleanRaw = rawSite.replace(/:/g, '').trim();
        matchedProj = await ProjectMaster.findOne({
            where: {
                [Op.or]: [
                    { siteId: cleanRaw },
                    { clientName: cleanRaw }
                ]
            }
        });
    }

    if (!matchedProj && !targetSp && rawClient && rawClient.length > 2) {
        matchedProj = await ProjectMaster.findOne({
            where: {
                clientName: rawClient
            }
        });
    }

    if (matchedProj) {
        const cap = matchedProj.siteCapacity ? `${matchedProj.siteCapacity}KW ` : '';
        const loc = matchedProj.location ? `, ${matchedProj.location}` : '';
        const fullClientSiteName = (rawClientSite && rawClientSite.toUpperCase().includes(matchedProj.siteId.toUpperCase()))
            ? rawClientSite
            : `${matchedProj.siteId} : ${cap}${matchedProj.clientName || ''}${loc}`.trim();
        return {
            siteId: matchedProj.siteId,
            clientName: matchedProj.clientName || ('Client ' + matchedProj.siteId),
            clientSiteName: fullClientSiteName
        };
    }

    const fallbackId = targetSp || (rawSite && !rawSite.startsWith('#') ? rawSite : 'UNASSIGNED');
    const fallbackName = rawClient ? rawClient : fallbackId;
    return {
        siteId: fallbackId,
        clientName: fallbackName,
        clientSiteName: rawClientSite || `${fallbackId} : ${fallbackName}`
    };
}

// Helper to recalculate and sync ProjectMaster received & due
async function syncProjectReceived(siteId) {
    if (!siteId) return null;
    const rawClean = String(siteId).replace(/:/g, '').trim();
    const spMatch = rawClean.match(/^SP\d+/i);
    const cleanSiteId = spMatch ? spMatch[0].toUpperCase() : rawClean;

    const totalRecv = await ClientPaymentLedger.sum('amount', {
        where: {
            [Op.or]: [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId },
                { siteId: { [Op.like]: `${cleanSiteId} %` } },
                { siteId: { [Op.like]: `${cleanSiteId}:%` } },
                { clientSiteName: { [Op.like]: `${cleanSiteId} %` } },
                { clientSiteName: { [Op.like]: `${cleanSiteId}:%` } }
            ]
        }
    }) || 0;

    const project = await ProjectMaster.findOne({
        where: {
            [Op.or]: [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId }
            ]
        }
    });
    if (project) {
        project.received = parseFloat(Number(totalRecv).toFixed(2));
        await project.save();
        return project;
    }
    return null;
}

// Helper to recalculate and sync ProjectMaster siteExpenses & margin & BOM items
async function syncProjectExpenses(siteId) {
    if (!siteId) return null;
    const rawClean = String(siteId).replace(/:/g, '').trim();
    const spMatch = rawClean.match(/^SP\d+/i);
    const cleanSiteId = spMatch ? spMatch[0].toUpperCase() : rawClean;

    const totalExp = await SiteExpenseLedger.sum('amount', {
        where: {
            [Op.or]: [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId },
                { siteId: { [Op.like]: `${cleanSiteId} %` } },
                { siteId: { [Op.like]: `${cleanSiteId}:%` } },
                { clientSiteName: { [Op.like]: `${cleanSiteId} %` } },
                { clientSiteName: { [Op.like]: `${cleanSiteId}:%` } }
            ]
        }
    }) || 0;

    const project = await ProjectMaster.findOne({
        where: {
            [Op.or]: [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId }
            ]
        }
    });
    if (project) {
        project.siteExpenses = parseFloat(Number(totalExp).toFixed(2));

        // Sync with ProjectMaster.bomItems if present
        if (project.bomItems) {
            try {
                let bomItems = [];
                if (typeof project.bomItems === 'string') {
                    bomItems = JSON.parse(project.bomItems);
                } else if (Array.isArray(project.bomItems)) {
                    bomItems = [...project.bomItems];
                }

                if (Array.isArray(bomItems) && bomItems.length > 0) {
                    const allSiteExpenses = await SiteExpenseLedger.findAll({ where: { siteId: cleanSiteId } });

                    // Reset allocated amounts
                    bomItems.forEach(b => {
                        b.allocatedExpenseAmount = 0;
                    });

                    allSiteExpenses.forEach(exp => {
                        const purp = (exp.purpose || '').toLowerCase().trim();
                        const cat = (exp.category || '').toLowerCase().trim();
                        const amt = parseFloat(exp.amount) || 0;
                        const pt = (exp.paymentThrough || '').trim();

                        let matched = bomItems.find(b => {
                            const grp = (b.materialGroup || '').toLowerCase().trim();
                            const bCat = (b.categoryType || '').toLowerCase().trim();
                            const spec = (b.specification || '').toLowerCase().trim();

                            if (grp && (purp.includes(grp) || cat.includes(grp))) return true;
                            if (bCat && purp.includes(bCat)) return true;
                            if (spec && purp.includes(spec)) return true;
                            return false;
                        });

                        if (matched) {
                            matched.allocatedExpenseAmount = (matched.allocatedExpenseAmount || 0) + amt;
                            if (pt.toLowerCase().includes('gatepass') || pt.toLowerCase().includes('warehouse')) {
                                matched.isDispatched = true;
                                matched.expenseSource = 'Warehouse';
                            } else if (pt.toUpperCase().includes('PO') || pt.toUpperCase().includes('WO')) {
                                matched.expenseSource = pt;
                            }
                        }
                    });

                    project.bomItems = JSON.stringify(bomItems);
                }
            } catch (err) {
                console.error('Error syncing BOM items in syncProjectExpenses:', err);
            }
        }

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
            const rawClean = String(siteId).replace(/:/g, '').trim();
            const spMatch = rawClean.match(/SP[-_\s]*(\d+)/i);
            const cleanSiteId = spMatch ? `SP${spMatch[1]}` : rawClean;

            const siteConditions = [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId },
                { siteId: { [Op.like]: `${cleanSiteId} %` } },
                { siteId: { [Op.like]: `${cleanSiteId}:%` } },
                { clientSiteName: { [Op.like]: `${cleanSiteId} %` } },
                { clientSiteName: { [Op.like]: `${cleanSiteId}:%` } }
            ];

            whereClause[Op.or] = siteConditions;
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

        const resolved = await resolveProjectSiteId(siteId, clientName, clientSiteName);
        let cleanSiteId = resolved.siteId;
        let finalClientName = resolved.clientName;
        let finalClientSiteName = resolved.clientSiteName;

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

        if (cleanSiteId === 'ALL_PAYMENTS') {
            await ClientPaymentLedger.destroy({ where: {} });

            // Reset ProjectMaster records in DB
            const allProjects = await ProjectMaster.findAll();
            for (const p of allProjects) {
                p.received = 0.00;
                const siteVal = parseFloat(p.siteValue) || 0;
                p.due = siteVal;
                const exp = parseFloat(p.siteExpenses) || 0;
                p.margin = 0.00 - exp;
                p.marginPercentage = siteVal > 0 ? parseFloat(((p.margin / siteVal) * 100).toFixed(2)) : 0;
                await p.save();
            }

            return res.status(200).json({
                success: true,
                message: 'All client payments removed successfully and dashboard balances reset.'
            });
        }

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
            const rawClean = String(siteId).replace(/:/g, '').trim();
            const spMatch = rawClean.match(/SP[-_\s]*(\d+)/i);
            const cleanSiteId = spMatch ? `SP${spMatch[1]}` : rawClean;

            const siteConditions = [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId },
                { siteId: { [Op.like]: `${cleanSiteId} %` } },
                { siteId: { [Op.like]: `${cleanSiteId}:%` } },
                { clientSiteName: { [Op.like]: `${cleanSiteId} %` } },
                { clientSiteName: { [Op.like]: `${cleanSiteId}:%` } }
            ];

            whereClause[Op.or] = siteConditions;
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

// Helper to get next Petty Cash reference number for a siteId (e.g. PC-1, PC-2...)
async function getOrAssignNextPettyCashRef(cleanSiteId) {
    if (!cleanSiteId) return 'PC-1';
    const siteExps = await SiteExpenseLedger.findAll({
        where: { siteId: cleanSiteId },
        order: [['expenseDate', 'ASC'], ['id', 'ASC']]
    });
    let maxPcNum = 0;
    for (const e of siteExps) {
        const r = (e.referenceNo || '').trim().toUpperCase();
        const m = r.match(/^PC-(\d+)$/i);
        if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxPcNum) maxPcNum = num;
        }
    }
    return `PC-${maxPcNum + 1}`;
}

// Helper to compute next sequential PO/WO number:
// For client: SOLAR/SP412/PO-001, SOLAR/SP412/PO-002... (or WO-001...)
// For warehouse: SOLAR/SWH/PO-001 (or continuing from highest existing SOLAR/SWH/PO-xxx)
async function computeNextPoWoNumber(siteId, orderType) {
    const rawSite = String(siteId || '').replace(/:/g, '').trim().toUpperCase();
    const isWarehouse = !rawSite || rawSite === 'WAREHOUSE' || rawSite === 'SWH' || rawSite === 'UNASSIGNED';
    const siteCode = isWarehouse ? 'SWH' : (rawSite.match(/^SP\d+/i) ? rawSite.match(/^SP\d+/i)[0].toUpperCase() : rawSite);
    const cleanType = String(orderType || 'PO').toUpperCase().includes('W') ? 'WO' : 'PO';
    const prefix = `SOLAR/${siteCode}/${cleanType}-`;

    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedPrefix}(\\d+)`, 'i');

    let maxNum = 0;
    try {
        const exps = await SiteExpenseLedger.findAll({
            where: {
                referenceNo: { [Op.like]: `${prefix}%` }
            },
            attributes: ['referenceNo'],
            raw: true
        });
        for (const e of exps) {
            const m = String(e.referenceNo || '').trim().match(regex);
            if (m) {
                const n = parseInt(m[1], 10);
                if (!isNaN(n) && n > maxNum) maxNum = n;
            }
        }
    } catch (e) {}

    try {
        const vPoWos = await VendorPoWo.findAll({
            where: {
                poWoNumber: { [Op.like]: `${prefix}%` }
            },
            attributes: ['poWoNumber'],
            raw: true
        });
        for (const vp of vPoWos) {
            const m = String(vp.poWoNumber || '').trim().match(regex);
            if (m) {
                const n = parseInt(m[1], 10);
                if (!isNaN(n) && n > maxNum) maxNum = n;
            }
        }
    } catch (e) {}

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

// Permanent Letterhead & PO/WO Config storage in server/uploads/letterheads/
const LETTERHEAD_DIR = path.join(__dirname, '..', 'uploads', 'letterheads');
const LETTERHEAD_CONFIG_PATH = path.join(LETTERHEAD_DIR, 'letterhead_config.json');

function ensureLetterheadDir() {
    if (!fs.existsSync(LETTERHEAD_DIR)) {
        fs.mkdirSync(LETTERHEAD_DIR, { recursive: true });
    }
}

function getLetterheadBase64(fileName) {
    try {
        const filePath = path.join(LETTERHEAD_DIR, fileName);
        if (fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            return 'data:image/png;base64,' + buf.toString('base64');
        }
    } catch (e) {}
    return '';
}

function getDefaultPoWoConfig() {
    const defaultHeaderB64 = getLetterheadBase64('header.png');
    const defaultFooterB64 = getLetterheadBase64('footer.png');
    return {
        po: {
            fileName: '',
            uploadedAt: null,
            headerImageBase64: '',
            footerImageBase64: '',
            headerTextLines: [
                'SATHLOKHAR SYNERGYS E&C GLOBAL LIMITED',
                'Plot No.5171, F2, Sathlokhar, 9th Street, Ram Nagar North Extension, Madipakkam, Chennai, Tamil Nadu - 600091',
                'GSTIN: 33AACCL5566B1ZT'
            ],
            defaultTermsTable: [
                { label: 'Specifications', value: 'As per ISI Standard,' },
                { label: 'Delivery schedule', value: 'Immediate' },
                { label: 'GST', value: 'Included' },
                { label: 'Loading', value: 'Included' },
                { label: 'Transportation charges', value: 'Included' },
                { label: 'Payment terms', value: '7 Days on Credit' }
            ],
            termsPages: [
                `ANNEXURE - I : GENERAL TERMS & CONDITIONS OF PURCHASE ORDER\n\n1. SCOPE OF SUPPLY:\nThe Supplier shall supply the Solar PV materials / equipment strictly in accordance with the technical specifications, make, and quantities specified in this Purchase Order.\n\n2. QUALITY & STANDARDS:\nAll materials supplied against this Purchase Order must be brand new, unused, and conform to relevant MNRE / IEC / BIS / ISI standards. Test certificates and warranty certificates shall be furnished along with the dispatch documents.\n\n3. PACKAGING & DISPATCH:\nMaterials shall be securely packed to prevent any transit damage. Each consignment must be accompanied by Tax Invoice, Delivery Challan, E-Way Bill, and Packing List clearly mentioning our Purchase Order Number.\n\n4. INSPECTION & REJECTION:\nAll materials are subject to inspection and verification at the delivery site / warehouse by Sathlokhar Synergys E&C Global Limited. Any defective, damaged, or non-conforming materials shall be replaced by the Supplier immediately at their own cost.`,
                `5. DELIVERY SCHEDULE & LIQUIDATED DAMAGES:\nTime is the essence of this Purchase Order. Delivery must be completed within the stipulated delivery schedule mentioned on Page 1. Any delay in delivery without prior written approval may attract liquidated damages.\n\n6. WARRANTY & GUARANTEE:\nThe Supplier warrants that all goods supplied under this Purchase Order shall be free from defects in design, material, and workmanship for the standard manufacturer warranty period from the date of commissioning or supply.\n\n7. INVOICING & PAYMENT TERMS:\nOriginal Tax Invoices mentioning GSTIN 33AACCL5566B1ZT and the Purchase Order Number must be submitted to our Accounts Department. Payment shall be processed as per the agreed credit terms specified in this Purchase Order.\n\n8. JURISDICTION:\nAny disputes arising out of or in connection with this Purchase Order shall be subject to the exclusive jurisdiction of the Courts at Chennai, Tamil Nadu.`
            ]
        },
        wo: {
            fileName: '',
            uploadedAt: null,
            headerImageBase64: '',
            footerImageBase64: '',
            headerTextLines: [
                'SATHLOKHAR SYNERGYS E&C GLOBAL LIMITED',
                'Plot No.5171, F2, Sathlokhar, 9th Street, Ram Nagar North Extension, Madipakkam, Chennai, Tamil Nadu - 600091',
                'GSTIN: 33AACCL5566B1ZT'
            ],
            defaultTermsTable: [
                { label: 'Scope of Work', value: 'As per Site Plan & MNRE / TANGEDCO Standards' },
                { label: 'Completion schedule', value: 'Immediate / As per Site Schedule' },
                { label: 'GST', value: 'Included' },
                { label: 'Tools & Tackles', value: 'Contractor Scope' },
                { label: 'Transportation & Shifting', value: 'Included' },
                { label: 'Payment terms', value: 'After Completion & Site Engineer Certification' }
            ],
            termsPages: [
                `ANNEXURE - I : GENERAL TERMS & CONDITIONS OF WORK ORDER\n\n1. SCOPE OF WORK:\nThe Contractor shall execute the Solar PV installation, structure erection, electrical cabling, earthing, and commissioning works strictly as per the approved drawings and instructions of our Site Engineer.\n\n2. SAFETY & WORKMANSHIP:\nThe Contractor must ensure that all workmen wear required Personal Protective Equipment (PPE) including safety helmets, safety shoes, and safety harnesses during rooftop work. Workmanship shall be neat, plumb, and compliant with CEIG / TANGEDCO safety norms.\n\n3. TOOLS, TACKLES & CONSUMABLES:\nAll necessary tools, drilling machines, crimping tools, testing instruments, and manpower required for executing the work are in the Contractor's scope.\n\n4. SITE CLEARANCE & HANDOVER:\nUpon completion of installation, the Contractor shall clear all debris, test the system string voltages and earthing continuity, and hand over the site with joint measurement certification signed by the Project Engineer.`,
                `5. DEFECT LIABILITY:\nAny installation defects, loose terminations, or water leakage caused during structure mounting shall be rectified by the Contractor free of cost within the defect liability period.\n\n6. BILLING & PAYMENT:\nBills must be submitted along with the Work Completion Certificate signed by the Site Engineer and Project Manager. Statutory TDS deductions as applicable under the Income Tax Act shall be made.\n\n7. JURISDICTION:\nAll disputes arising out of this Work Order shall be subject to the exclusive jurisdiction of the Courts at Chennai, Tamil Nadu.`
            ]
        },
        bomMaterialDescriptions: {
            'Structure': {
                description: `Supply of Solar Module Mounting Structures (2X5),\nNorth Leg 2.7MTR (72 X 72 X 2)mm Square Tube 3 Nos\nSouth Leg 2.2MTR (72 X 72 X 2)mm Square Tube 3 Nos\nRafter (75 X 75 X 2)mm Galvanized Dip Channel\nPurlin (80 X 40 X 1.6)mm Galvanized Dip Channel\nMid Clamp as required\nEnd Clamp as required\nAnchor Bolt & Nut as required`,
                unit: 'KW',
                gstPct: 18,
                rate: 5500
            },
            'Solar MMS': {
                description: `Supply of Solar Module Mounting Structures (2X5),\nNorth Leg 2.7MTR (72 X 72 X 2)mm Square Tube 3 Nos\nSouth Leg 2.2MTR (72 X 72 X 2)mm Square Tube 3 Nos\nRafter (75 X 75 X 2)mm Galvanized Dip Channel\nPurlin (80 X 40 X 1.6)mm Galvanized Dip Channel\nMid Clamp as required\nEnd Clamp as required\nAnchor Bolt & Nut as required`,
                unit: 'KW',
                gstPct: 18,
                rate: 5500
            },
            'Cables': {
                description: `Supply of Solar DC & AC Cables (ISI / TUV Certified),\nDC Cable - XLPO 4 Sqmm Red & Black UV Protected Copper Flexible Cable\nAC Cable - 4 Sqmm / 6 Sqmm Multi-strand Copper Armoured / Flexible Cable\nConduit Pipes, Bends, Saddles, Cable Glands & Lugs as per site requirement`,
                unit: 'Mtr',
                gstPct: 18,
                rate: 65
            },
            'Panels': {
                description: `Supply of Solar Photovoltaic Modules (ALMM Approved / BIS Certified),\nMono PERC / TOPCon Bifacial Half-Cut High Efficiency Solar PV Modules\nWith IP68 Junction Box, MC4 Compatible Connectors & Anodized Aluminium Frame`,
                unit: 'Nos',
                gstPct: 5,
                rate: 14500
            },
            'Inverters': {
                description: `Supply of Grid-Tied String Solar Inverter (MNRE / BIS Certified),\nWith Built-in DC Switch, IP65 Protection, Wi-Fi / Remote Monitoring Dongle\nStandard Manufacturer Warranty Certificate included`,
                unit: 'Nos',
                gstPct: 5,
                rate: 28000
            },
            'Earthing Materials': {
                description: `Supply of Earthing & Lightning Protection Materials,\nCopper Bonded Chemical Earthing Electrode Rod with Backfill Compound (BFC) Bag\nEarth Pit Chamber Cover, ESE / Copper Spike Lightning Arrester & GI/Copper Strip`,
                unit: 'Set',
                gstPct: 18,
                rate: 4500
            },
            'DB Boxes': {
                description: `Supply of Solar ACDB & DCDB Protection Boxes (IP65 Polycarbonate Enclosure),\nDCDB with 1000V DC MCB / Fuse & Type-2 DC SPD\nACDB with AC MCB, Type-2 AC SPD, L&T / Secure Solar Net Meter Box & Wiring`,
                unit: 'Set',
                gstPct: 18,
                rate: 4200
            },
            'Consumables': {
                description: `Supply of Solar Installation Consumables & Hardware Accessories,\nSS304 Allen Bolts, Hex Bolts, Spring & Flat Washers, Anchor Fasteners,\nUV Stabilized Cable Ties, MC4 Connectors, Ferrules & Insulation Tapes`,
                unit: 'LS',
                gstPct: 18,
                rate: 3500
            }
        },
        savedPoWoDocs: {}
    };
}

function readPoWoConfig() {
    ensureLetterheadDir();
    const defaults = getDefaultPoWoConfig();
    if (!fs.existsSync(LETTERHEAD_CONFIG_PATH)) {
        fs.writeFileSync(LETTERHEAD_CONFIG_PATH, JSON.stringify(defaults, null, 2), 'utf8');
        return defaults;
    }
    try {
        const raw = fs.readFileSync(LETTERHEAD_CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        const mergedBom = { ...defaults.bomMaterialDescriptions, ...(parsed.bomMaterialDescriptions || {}) };
        // Ensure Panels & Inverters default to 5% GST and all other materials default to 18% GST if previously 12%
        for (const k of Object.keys(mergedBom)) {
            const lower = k.toLowerCase();
            if (lower.includes('panel') || lower.includes('inverter')) {
                if (mergedBom[k] && mergedBom[k].gstPct === 12) mergedBom[k].gstPct = 5;
            } else if (mergedBom[k] && mergedBom[k].gstPct === 12) {
                mergedBom[k].gstPct = 18;
            }
        }
        return {
            po: {
                ...defaults.po,
                ...(parsed.po || {}),
                headerImageBase64: (parsed.po && parsed.po.headerImageBase64) ? parsed.po.headerImageBase64 : (defaults.po.headerImageBase64 || getLetterheadBase64('header.png')),
                footerImageBase64: (parsed.po && parsed.po.footerImageBase64) ? parsed.po.footerImageBase64 : (defaults.po.footerImageBase64 || getLetterheadBase64('footer.png'))
            },
            wo: {
                ...defaults.wo,
                ...(parsed.wo || {}),
                headerImageBase64: (parsed.wo && parsed.wo.headerImageBase64) ? parsed.wo.headerImageBase64 : (defaults.wo.headerImageBase64 || getLetterheadBase64('header.png')),
                footerImageBase64: (parsed.wo && parsed.wo.footerImageBase64) ? parsed.wo.footerImageBase64 : (defaults.wo.footerImageBase64 || getLetterheadBase64('footer.png'))
            },
            bomMaterialDescriptions: mergedBom,
            savedPoWoDocs: parsed.savedPoWoDocs || {}
        };
    } catch (e) {
        return defaults;
    }
}

function writePoWoConfig(cfg) {
    ensureLetterheadDir();
    fs.writeFileSync(LETTERHEAD_CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

// Native .docx (ZIP) reader in Node.js using built-in zlib
function extractDocxContent(buffer) {
    const entries = {};
    try {
        // Find End of Central Directory (EOCD) signature 0x06054b50
        let eocdOffset = -1;
        for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
            if (buffer.readUInt32LE(i) === 0x06054b50) {
                eocdOffset = i;
                break;
            }
        }

        if (eocdOffset !== -1) {
            const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
            const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
            let ptr = cdOffset;

            for (let idx = 0; idx < totalEntries && ptr < eocdOffset; idx++) {
                if (buffer.readUInt32LE(ptr) !== 0x02014b50) break;
                const compressionMethod = buffer.readUInt16LE(ptr + 10);
                const compressedSize = buffer.readUInt32LE(ptr + 20);
                const fileNameLen = buffer.readUInt16LE(ptr + 28);
                const extraLen = buffer.readUInt16LE(ptr + 30);
                const commentLen = buffer.readUInt16LE(ptr + 32);
                const localHeaderOffset = buffer.readUInt32LE(ptr + 42);
                const entryName = buffer.slice(ptr + 46, ptr + 46 + fileNameLen).toString('utf8');

                if (buffer.readUInt32LE(localHeaderOffset) === 0x04034b50) {
                    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
                    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
                    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
                    const compData = buffer.slice(dataStart, dataStart + compressedSize);
                    if (compressionMethod === 0) {
                        entries[entryName] = compData;
                    } else if (compressionMethod === 8) {
                        entries[entryName] = zlib.inflateRawSync(compData);
                    }
                }
                ptr += 46 + fileNameLen + extraLen + commentLen;
            }
        }
    } catch (zipErr) {
        console.error('Error reading docx zip structure:', zipErr.message);
    }

    const decodeXmlEntities = (str) => {
        return String(str || '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
    };

    const extractParagraphsFromXml = (xmlStr) => {
        if (!xmlStr) return [];
        const pages = [];
        let currentLines = [];

        // Split by paragraph <w:p ...>...</w:p>
        const pMatches = xmlStr.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
        for (const pXml of pMatches) {
            const hasPageBreak = /<w:br[^>]*w:type=["']page["']/i.test(pXml) || /<w:lastRenderedPageBreak\s*\/>/i.test(pXml);
            const tMatches = pXml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) || [];
            const lineText = decodeXmlEntities(
                tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('')
            ).trim();

            if (hasPageBreak && currentLines.length > 0) {
                pages.push(currentLines.join('\n'));
                currentLines = [];
            }
            if (lineText) {
                currentLines.push(lineText);
            }
        }
        if (currentLines.length > 0) {
            pages.push(currentLines.join('\n'));
        }
        return pages;
    };

    // Extract images from word/media/*
    const mediaImages = [];
    Object.keys(entries).sort().forEach(k => {
        if (k.startsWith('word/media/')) {
            const lower = k.toLowerCase();
            let mime = '';
            if (lower.endsWith('.png')) mime = 'image/png';
            else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
            if (mime) {
                mediaImages.push(`data:${mime};base64,${entries[k].toString('base64')}`);
            }
        }
    });

    // Extract header lines
    const headerLines = [];
    Object.keys(entries).sort().forEach(k => {
        if (k.startsWith('word/header') && k.endsWith('.xml')) {
            const hPages = extractParagraphsFromXml(entries[k].toString('utf8'));
            hPages.forEach(p => {
                p.split('\n').forEach(l => {
                    if (l.trim() && !headerLines.includes(l.trim())) headerLines.push(l.trim());
                });
            });
        }
    });

    // Extract main document pages
    let docPages = [];
    if (entries['word/document.xml']) {
        const rawPages = extractParagraphsFromXml(entries['word/document.xml'].toString('utf8'));
        if (rawPages.length === 1) {
            // If Word didn't insert explicit <w:br w:type="page"/>, chunk long terms into ~35-line pages
            const allLines = rawPages[0].split('\n').filter(Boolean);
            if (allLines.length > 35) {
                for (let i = 0; i < allLines.length; i += 35) {
                    docPages.push(allLines.slice(i, i + 35).join('\n'));
                }
            } else if (allLines.length > 0) {
                docPages = [allLines.join('\n')];
            }
        } else {
            docPages = rawPages;
        }
    }

    return {
        headerImageBase64: mediaImages[0] || '',
        footerImageBase64: mediaImages.length > 1 ? mediaImages[mediaImages.length - 1] : '',
        headerTextLines: headerLines,
        docPages
    };
}

// Sync a PO/WO expense entry into VendorPoWo so it reflects in Vendor Ledger
async function syncExpenseWithVendorLedger(expenseRecord) {
    try {
        if (!expenseRecord || !expenseRecord.vendorName) return;
        const pt = String(expenseRecord.paymentThrough || '').toUpperCase();
        const ref = String(expenseRecord.referenceNo || '').trim();
        if (!pt.includes('P.O') && !pt.includes('W.O') && !pt.includes('PO') && !pt.includes('WO') && !ref.toUpperCase().includes('SOLAR/')) {
            return;
        }

        const cleanVendorName = expenseRecord.vendorName.replace(/^M\/s\.?\s*/i, '').replace(/,+$/, '').trim();
        if (!cleanVendorName) return;

        const vendor = await OfficeVendor.findOne({
            where: {
                [Op.or]: [
                    { vendorName: expenseRecord.vendorName.trim() },
                    { vendorName: cleanVendorName },
                    { vendorName: { [Op.like]: `%${cleanVendorName}%` } }
                ]
            }
        });
        if (!vendor) return;

        const poWoNumber = ref || `PO-${expenseRecord.id}`;
        const orderType = (pt.includes('W.O') || pt === 'WO' || poWoNumber.toUpperCase().includes('/WO-')) ? 'W.O' : 'P.O';
        const clientLabel = expenseRecord.siteId === 'WAREHOUSE'
            ? 'Central Warehouse (SWH)'
            : `${expenseRecord.clientName || ''} (${expenseRecord.siteId || ''})`.trim();

        const existing = await VendorPoWo.findOne({
            where: {
                vendorId: vendor.id,
                poWoNumber: poWoNumber
            }
        });

        if (existing) {
            await existing.update({
                date: expenseRecord.expenseDate,
                orderValue: parseFloat(expenseRecord.amount) || 0,
                materialDescription: expenseRecord.purpose || '',
                clientName: clientLabel,
                orderType,
                generatedBy: expenseRecord.paidBy || 'OFFICE',
                billVoucherStatus: expenseRecord.billVoucher || 'Not Submitted',
                invoiceNo: expenseRecord.invoiceNo || '',
                remarks: expenseRecord.remarks || ''
            });
        } else {
            await VendorPoWo.create({
                vendorId: vendor.id,
                date: expenseRecord.expenseDate,
                poWoNumber: poWoNumber,
                orderValue: parseFloat(expenseRecord.amount) || 0,
                materialDescription: expenseRecord.purpose || '',
                clientName: clientLabel,
                orderType,
                generatedBy: expenseRecord.paidBy || 'OFFICE',
                billVoucherStatus: expenseRecord.billVoucher || 'Not Submitted',
                invoiceNo: expenseRecord.invoiceNo || '',
                remarks: expenseRecord.remarks || ''
            });
        }
    } catch (err) {
        console.warn('Warning syncing PO/WO with VendorPoWo:', err.message);
    }
}

exports.createExpense = async (req, res) => {
    try {
        const { sNo, mop, siteId, clientSiteName, clientName, expenseDate, amount, paymentThrough, purpose, paidBy, remarks, billVoucher, invoiceNo, claimStatus, paymentNote, vendorName, vendor, referenceNo, poWoDoc, bomTemplateUpdate } = req.body;

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'A valid positive amount is required.' });
        }

        const resolved = await resolveProjectSiteId(siteId, clientName, clientSiteName);
        let cleanSiteId = resolved.siteId;
        let finalClientName = resolved.clientName;
        let finalClientSiteName = resolved.clientSiteName;

        const isoDate = parseToIsoDate(expenseDate);
        const finalMoP = mop || deriveMoP(isoDate);
        const finalVendor = (vendorName || vendor || '').trim();
        const rawRef = (referenceNo || '').trim();
        const cleanRef = ['P.O', 'W.O', 'Petty Cash', 'Accounts', 'WAREHOUSE', 'Not Submitted', 'Submitted', '-'].includes(rawRef) ? '' : rawRef;
        const isPoWoRef = cleanRef && !cleanRef.toUpperCase().startsWith('PC-') && (cleanRef.toUpperCase().includes('PO') || cleanRef.toUpperCase().includes('WO') || cleanRef.toUpperCase().includes('SOLAR'));

        let finalRef = cleanRef;
        let finalPaymentThrough = paymentThrough || 'Petty Cash';

        if (finalPaymentThrough === 'P.O' || finalPaymentThrough === 'W.O') {
            if (!finalRef || finalRef.toUpperCase().startsWith('PC-')) {
                finalRef = await computeNextPoWoNumber(cleanSiteId || 'UNASSIGNED', finalPaymentThrough);
            }
        } else if (!isPoWoRef && finalPaymentThrough !== 'Warehouse' && finalPaymentThrough !== 'WAREHOUSE') {
            if (!finalRef || finalRef.toUpperCase().startsWith('PC') || finalPaymentThrough === 'Petty Cash') {
                finalRef = await getOrAssignNextPettyCashRef(cleanSiteId || 'UNASSIGNED');
                if (!['Gatepass', 'GatePass', 'Accounts', 'Warehouse', 'WAREHOUSE'].includes(finalPaymentThrough)) {
                    finalPaymentThrough = 'Petty Cash';
                }
            }
        }

        const rawInv = (invoiceNo || '').trim();
        const cleanInv = ['Not Submitted', 'Submitted', 'P.O', 'W.O', 'Petty Cash', 'WAREHOUSE', '-'].includes(rawInv) ? '' : rawInv;

        const newExpense = await SiteExpenseLedger.create({
            sNo: sNo ? parseInt(sNo) : null,
            mop: finalMoP,
            expenseDate: isoDate,
            siteId: cleanSiteId || 'UNASSIGNED',
            clientSiteName: finalClientSiteName || cleanSiteId,
            clientName: finalClientName || 'Client ' + cleanSiteId,
            amount: parseFloat(amount),
            paymentThrough: finalPaymentThrough,
            purpose: purpose || 'Consumables',
            paidBy: paidBy || 'OFFICE',
            remarks: remarks || '',
            billVoucher: billVoucher || 'Not Submitted',
            invoiceNo: cleanInv,
            claimStatus: claimStatus || '',
            paymentNote: paymentNote || '',
            category: purpose || 'Materials Supply',
            vendorName: finalVendor,
            description: remarks || '',
            referenceNo: finalRef
        });

        // Persist PO/WO letterhead doc and reusable BOM material description if provided
        if (poWoDoc || bomTemplateUpdate) {
            try {
                const cfg = readPoWoConfig();
                if (poWoDoc && finalRef) {
                    cfg.savedPoWoDocs = cfg.savedPoWoDocs || {};
                    cfg.savedPoWoDocs[finalRef] = { ...poWoDoc, poWoNo: finalRef, expenseId: newExpense.id };
                }
                if (bomTemplateUpdate && bomTemplateUpdate.key && bomTemplateUpdate.description) {
                    cfg.bomMaterialDescriptions = cfg.bomMaterialDescriptions || {};
                    cfg.bomMaterialDescriptions[bomTemplateUpdate.key] = {
                        description: bomTemplateUpdate.description,
                        unit: bomTemplateUpdate.unit || 'Nos',
                        gstPct: bomTemplateUpdate.gstPct !== undefined ? Number(bomTemplateUpdate.gstPct) : 18,
                        rate: bomTemplateUpdate.rate !== undefined ? Number(bomTemplateUpdate.rate) : 0
                    };
                }
                writePoWoConfig(cfg);
            } catch (cfgErr) {
                console.warn('Error saving poWoDoc config:', cfgErr.message);
            }
        }

        // If this is a Warehouse PO with items, automatically add those items to Warehouse stock
        if (cleanSiteId === 'WAREHOUSE' && poWoDoc && Array.isArray(poWoDoc.items) && poWoDoc.items.length > 0) {
            try {
                const { addWarehouseStock } = require('./inventoryController');
                if (typeof addWarehouseStock === 'function') {
                    const whItems = poWoDoc.items.map(it => ({
                        materialName: it.description || it.materialGroup || 'Material',
                        materialGroup: it.materialGroup || null,
                        specification: it.specification || null,
                        quantity: parseFloat(it.qty) || 0,
                        unit: it.unit || 'Nos',
                        rate: parseFloat(it.rate) || 0,
                        amount: parseFloat(it.amount) || 0
                    }));
                    await addWarehouseStock(whItems);
                }
            } catch (whErr) {
                console.warn('Error adding warehouse stock from PO:', whErr.message);
            }
        }

        // Sync with Vendor Ledger
        await syncExpenseWithVendorLedger(newExpense);

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
        const { sNo, mop, siteId, clientSiteName, clientName, expenseDate, amount, paymentThrough, purpose, paidBy, remarks, billVoucher, invoiceNo, claimStatus, paymentNote, vendorName, vendor, referenceNo, poWoDoc, bomTemplateUpdate } = req.body;

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

        const rawRef = referenceNo !== undefined ? String(referenceNo).trim() : expense.referenceNo;
        const cleanRef = ['P.O', 'W.O', 'Petty Cash', 'Accounts', 'WAREHOUSE', 'Not Submitted', 'Submitted', '-'].includes(rawRef) ? '' : rawRef;
        const isPoWoRef = cleanRef && !cleanRef.toUpperCase().startsWith('PC-') && (cleanRef.toUpperCase().includes('PO') || cleanRef.toUpperCase().includes('WO') || cleanRef.toUpperCase().includes('SOLAR'));

        let finalRef = cleanRef;
        let finalPaymentThrough = paymentThrough !== undefined ? paymentThrough : expense.paymentThrough;

        if (finalPaymentThrough === 'P.O' || finalPaymentThrough === 'W.O') {
            if (!finalRef || finalRef.toUpperCase().startsWith('PC-')) {
                finalRef = await computeNextPoWoNumber(cleanSiteId || 'UNASSIGNED', finalPaymentThrough);
            }
        } else if (!isPoWoRef && finalPaymentThrough !== 'Warehouse' && finalPaymentThrough !== 'WAREHOUSE') {
            if (cleanSiteId === oldSiteId && expense.referenceNo && expense.referenceNo.toUpperCase().startsWith('PC-')) {
                finalRef = expense.referenceNo;
            } else {
                finalRef = await getOrAssignNextPettyCashRef(cleanSiteId || 'UNASSIGNED');
            }
            if (!['Gatepass', 'GatePass', 'Accounts', 'Warehouse', 'WAREHOUSE'].includes(finalPaymentThrough)) {
                finalPaymentThrough = 'Petty Cash';
            }
        }

        const rawInv = invoiceNo !== undefined ? String(invoiceNo).trim() : expense.invoiceNo;
        const cleanInv = ['Not Submitted', 'Submitted', 'P.O', 'W.O', 'Petty Cash', 'WAREHOUSE', '-'].includes(rawInv) ? '' : rawInv;

        await expense.update({
            sNo: sNo !== undefined ? (parseInt(sNo) || null) : expense.sNo,
            mop: finalMoP,
            expenseDate: isoDate,
            siteId: cleanSiteId,
            clientSiteName: finalClientSiteName,
            clientName: finalClientName,
            amount: amount !== undefined ? parseFloat(amount) : expense.amount,
            paymentThrough: finalPaymentThrough,
            purpose: purpose !== undefined ? purpose : expense.purpose,
            paidBy: paidBy !== undefined ? paidBy : expense.paidBy,
            remarks: remarks !== undefined ? remarks : expense.remarks,
            billVoucher: billVoucher !== undefined ? billVoucher : expense.billVoucher,
            invoiceNo: cleanInv,
            referenceNo: finalRef,
            claimStatus: claimStatus !== undefined ? claimStatus : expense.claimStatus,
            paymentNote: paymentNote !== undefined ? paymentNote : expense.paymentNote,
            category: purpose !== undefined ? purpose : expense.category,
            vendorName: resolvedVendor !== undefined ? (resolvedVendor || '').trim() : expense.vendorName,
            description: remarks !== undefined ? remarks : expense.description
        });

        if (poWoDoc || bomTemplateUpdate) {
            try {
                const cfg = readPoWoConfig();
                if (poWoDoc && finalRef) {
                    cfg.savedPoWoDocs = cfg.savedPoWoDocs || {};
                    cfg.savedPoWoDocs[finalRef] = { ...poWoDoc, poWoNo: finalRef, expenseId: expense.id };
                }
                if (bomTemplateUpdate && bomTemplateUpdate.key && bomTemplateUpdate.description) {
                    cfg.bomMaterialDescriptions = cfg.bomMaterialDescriptions || {};
                    cfg.bomMaterialDescriptions[bomTemplateUpdate.key] = {
                        description: bomTemplateUpdate.description,
                        unit: bomTemplateUpdate.unit || 'Nos',
                        gstPct: bomTemplateUpdate.gstPct !== undefined ? Number(bomTemplateUpdate.gstPct) : 18,
                        rate: bomTemplateUpdate.rate !== undefined ? Number(bomTemplateUpdate.rate) : 0
                    };
                }
                writePoWoConfig(cfg);
            } catch (cfgErr) {
                console.warn('Error saving poWoDoc config on update:', cfgErr.message);
            }
        }

        await syncExpenseWithVendorLedger(expense);

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

        if (cleanSiteId === 'CLIENT_ALL') {
            await SiteExpenseLedger.destroy({
                where: {
                    [Op.or]: [
                        { siteId: { [Op.ne]: 'WAREHOUSE' } },
                        { siteId: null },
                        { siteId: '' }
                    ]
                }
            });

            // Reset ProjectMaster records in DB
            const allProjects = await ProjectMaster.findAll();
            for (const p of allProjects) {
                p.siteExpenses = 0.00;
                const siteVal = parseFloat(p.siteValue) || 0;
                const recv = parseFloat(p.received) || 0;
                p.margin = recv - 0.00;
                p.marginPercentage = siteVal > 0 ? parseFloat(((p.margin / siteVal) * 100).toFixed(2)) : 0;

                if (p.bomItems) {
                    try {
                        let bom = typeof p.bomItems === 'string' ? JSON.parse(p.bomItems) : p.bomItems;
                        if (Array.isArray(bom)) {
                            bom.forEach(b => {
                                b.allocatedExpenseAmount = 0;
                            });
                            p.bomItems = JSON.stringify(bom);
                        }
                    } catch (e) {}
                }
                await p.save();
            }

            return res.status(200).json({
                success: true,
                message: 'All client expenses removed successfully and dashboard balances reset.'
            });
        }

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

// --- PO / WO LETTERHEAD & CONFIG ENDPOINTS ---

exports.getPoWoConfig = async (req, res) => {
    try {
        const cfg = readPoWoConfig();
        return res.status(200).json({
            success: true,
            folderPath: LETTERHEAD_DIR,
            data: cfg
        });
    } catch (err) {
        console.error('Error reading PO/WO config:', err);
        return res.status(500).json({ success: false, message: 'Failed to load PO/WO letterhead config', error: err.message });
    }
};

exports.getNextPoWoNumber = async (req, res) => {
    try {
        const { siteId, type } = req.query;
        const nextNo = await computeNextPoWoNumber(siteId || 'SWH', type || 'PO');
        return res.status(200).json({
            success: true,
            nextNumber: nextNo
        });
    } catch (err) {
        console.error('Error computing next PO/WO number:', err);
        return res.status(500).json({ success: false, message: 'Failed to compute next PO/WO number', error: err.message });
    }
};

exports.uploadPoWoLetterhead = async (req, res) => {
    try {
        const { type, fileName, fileBase64, termsPages, headerImageBase64, footerImageBase64, headerTextLines, defaultTermsTable } = req.body;
        const targetKey = String(type || 'PO').toUpperCase().includes('W') ? 'wo' : 'po';
        const cfg = readPoWoConfig();

        ensureLetterheadDir();

        if (fileBase64) {
            const cleanBase64 = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
            const buf = Buffer.from(cleanBase64, 'base64');
            const ext = (fileName && path.extname(fileName)) ? path.extname(fileName).toLowerCase() : '.docx';
            const savedFileName = `${targetKey.toUpperCase()}_Letterhead${ext}`;
            const savedFilePath = path.join(LETTERHEAD_DIR, savedFileName);
            fs.writeFileSync(savedFilePath, buf);

            cfg[targetKey].fileName = fileName || savedFileName;
            cfg[targetKey].uploadedAt = new Date().toISOString();

            if (ext === '.docx') {
                const extracted = extractDocxContent(buf);
                if (extracted.headerImageBase64) {
                    cfg[targetKey].headerImageBase64 = extracted.headerImageBase64;
                }
                if (extracted.footerImageBase64) {
                    cfg[targetKey].footerImageBase64 = extracted.footerImageBase64;
                }
                if (extracted.headerTextLines && extracted.headerTextLines.length > 0) {
                    cfg[targetKey].headerTextLines = extracted.headerTextLines;
                }
                if (extracted.docPages && extracted.docPages.length > 0) {
                    // If the .docx has Page 1 as PO cover and Page 2+ as Terms & Conditions, or all pages as Terms & Conditions
                    const pagesToUse = extracted.docPages.length > 1 ? extracted.docPages.slice(1) : extracted.docPages;
                    cfg[targetKey].termsPages = pagesToUse;
                }
            } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
                const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
                cfg[targetKey].headerImageBase64 = `data:${mime};base64,${cleanBase64}`;
            }
        }

        if (Array.isArray(termsPages) && termsPages.length > 0) {
            cfg[targetKey].termsPages = termsPages;
        }
        if (headerImageBase64 !== undefined) {
            cfg[targetKey].headerImageBase64 = headerImageBase64;
        }
        if (footerImageBase64 !== undefined) {
            cfg[targetKey].footerImageBase64 = footerImageBase64;
        }
        if (Array.isArray(headerTextLines) && headerTextLines.length > 0) {
            cfg[targetKey].headerTextLines = headerTextLines;
        }
        if (Array.isArray(defaultTermsTable) && defaultTermsTable.length > 0) {
            cfg[targetKey].defaultTermsTable = defaultTermsTable;
        }

        writePoWoConfig(cfg);

        return res.status(200).json({
            success: true,
            message: `${targetKey.toUpperCase()} Letterhead & Terms saved permanently!`,
            folderPath: LETTERHEAD_DIR,
            data: cfg
        });
    } catch (err) {
        console.error('Error uploading PO/WO letterhead:', err);
        return res.status(500).json({ success: false, message: 'Failed to save PO/WO letterhead', error: err.message });
    }
};

exports.updatePoWoConfig = async (req, res) => {
    try {
        const { po, wo, bomMaterialDescriptions, savedPoWoDocs } = req.body;
        const cfg = readPoWoConfig();

        if (po) {
            cfg.po = { ...cfg.po, ...po };
        }
        if (wo) {
            cfg.wo = { ...cfg.wo, ...wo };
        }
        if (bomMaterialDescriptions) {
            cfg.bomMaterialDescriptions = { ...cfg.bomMaterialDescriptions, ...bomMaterialDescriptions };
        }
        if (savedPoWoDocs) {
            cfg.savedPoWoDocs = { ...(cfg.savedPoWoDocs || {}), ...savedPoWoDocs };
        }

        writePoWoConfig(cfg);
        return res.status(200).json({
            success: true,
            message: 'PO/WO configuration updated permanently.',
            data: cfg
        });
    } catch (err) {
        console.error('Error updating PO/WO config:', err);
        return res.status(500).json({ success: false, message: 'Failed to update PO/WO config', error: err.message });
    }
};

