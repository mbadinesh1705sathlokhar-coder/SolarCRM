const { Op } = require('sequelize');
const { ClientPaymentLedger } = require('../models/ClientPaymentLedger');
const { SiteExpenseLedger } = require('../models/SiteExpenseLedger');
const { ProjectMaster, computeMetrics } = require('../models/ProjectMaster');

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
                const mm = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(jsDate.getUTCDate()).padStart(2, '0');
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
    const rawInput = `${siteId || ''} ${clientName || ''} ${clientSiteName || ''}`.trim();
    if (!rawInput) return { siteId: 'UNASSIGNED', clientName: 'General', clientSiteName: 'UNASSIGNED' };

    // Extract SP code if present (e.g., SP410, SP-410, SP 410)
    const spMatch = rawInput.match(/SP[-_\s]*(\d+)/i);
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
                    { siteId: { [Op.like]: `${targetSp}%` } }
                ]
            }
        });
    }

    if (!matchedProj && siteId) {
        const cleanRaw = String(siteId).replace(/:/g, '').trim();
        matchedProj = await ProjectMaster.findOne({
            where: {
                [Op.or]: [
                    { siteId: cleanRaw },
                    { siteId: { [Op.like]: `%${cleanRaw}%` } },
                    { clientName: { [Op.like]: `%${cleanRaw}%` } },
                    { location: { [Op.like]: `%${cleanRaw}%` } }
                ]
            }
        });
    }

    if (!matchedProj && clientName) {
        const cleanName = String(clientName).trim();
        if (cleanName && cleanName.length > 2) {
            matchedProj = await ProjectMaster.findOne({
                where: {
                    [Op.or]: [
                        { clientName: { [Op.like]: `%${cleanName}%` } },
                        { location: { [Op.like]: `%${cleanName}%` } }
                    ]
                }
            });
        }
    }

    if (matchedProj) {
        const cap = matchedProj.siteCapacity ? `${matchedProj.siteCapacity}KW ` : '';
        const loc = matchedProj.location ? `, ${matchedProj.location}` : '';
        const fullClientSiteName = `${matchedProj.siteId} : ${cap}${matchedProj.clientName || ''}${loc}`.trim();
        return {
            siteId: matchedProj.siteId,
            clientName: matchedProj.clientName || ('Client ' + matchedProj.siteId),
            clientSiteName: fullClientSiteName
        };
    }

    const fallbackId = targetSp || (siteId ? String(siteId).trim() : 'UNASSIGNED');
    const fallbackName = clientName ? String(clientName).trim() : fallbackId;
    return {
        siteId: fallbackId,
        clientName: fallbackName,
        clientSiteName: `${fallbackId} : ${fallbackName}`
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
                { siteId: { [Op.like]: `${cleanSiteId}%` } },
                { clientSiteName: { [Op.like]: `%${cleanSiteId}%` } }
            ]
        }
    }) || 0;

    const project = await ProjectMaster.findOne({
        where: {
            [Op.or]: [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId },
                { siteId: { [Op.like]: `${cleanSiteId}%` } }
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
                { siteId: { [Op.like]: `${cleanSiteId}%` } },
                { clientSiteName: { [Op.like]: `%${cleanSiteId}%` } }
            ]
        }
    }) || 0;

    const project = await ProjectMaster.findOne({
        where: {
            [Op.or]: [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId },
                { siteId: { [Op.like]: `${cleanSiteId}%` } }
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

            const matchedProj = await ProjectMaster.findOne({
                where: {
                    [Op.or]: [
                        { siteId: siteId },
                        { siteId: rawClean },
                        { siteId: cleanSiteId },
                        { siteId: { [Op.like]: `${cleanSiteId}%` } }
                    ]
                }
            });

            const siteConditions = [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId },
                { siteId: { [Op.like]: `${cleanSiteId}%` } },
                { clientSiteName: { [Op.like]: `%${cleanSiteId}%` } },
                { clientName: { [Op.like]: `%${cleanSiteId}%` } }
            ];

            if (matchedProj) {
                if (matchedProj.clientName && matchedProj.clientName.trim()) {
                    const cn = matchedProj.clientName.trim();
                    siteConditions.push({ clientName: { [Op.like]: `%${cn}%` } });
                    siteConditions.push({ clientSiteName: { [Op.like]: `%${cn}%` } });
                }
                if (matchedProj.location && matchedProj.location.trim().length > 2) {
                    const loc = matchedProj.location.trim();
                    siteConditions.push({ clientSiteName: { [Op.like]: `%${loc}%` } });
                }
            }

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

            const matchedProj = await ProjectMaster.findOne({
                where: {
                    [Op.or]: [
                        { siteId: siteId },
                        { siteId: rawClean },
                        { siteId: cleanSiteId },
                        { siteId: { [Op.like]: `${cleanSiteId}%` } }
                    ]
                }
            });

            const siteConditions = [
                { siteId: siteId },
                { siteId: rawClean },
                { siteId: cleanSiteId },
                { siteId: { [Op.like]: `${cleanSiteId}%` } },
                { clientSiteName: { [Op.like]: `%${cleanSiteId}%` } },
                { clientName: { [Op.like]: `%${cleanSiteId}%` } }
            ];

            if (matchedProj) {
                if (matchedProj.clientName && matchedProj.clientName.trim()) {
                    const cn = matchedProj.clientName.trim();
                    siteConditions.push({ clientName: { [Op.like]: `%${cn}%` } });
                    siteConditions.push({ clientSiteName: { [Op.like]: `%${cn}%` } });
                }
                if (matchedProj.location && matchedProj.location.trim().length > 2) {
                    const loc = matchedProj.location.trim();
                    siteConditions.push({ clientSiteName: { [Op.like]: `%${loc}%` } });
                }
            }

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

exports.createExpense = async (req, res) => {
    try {
        const { sNo, mop, siteId, clientSiteName, clientName, expenseDate, amount, paymentThrough, purpose, paidBy, remarks, billVoucher, invoiceNo, claimStatus, paymentNote, vendorName, vendor, referenceNo } = req.body;

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

        if (!isPoWoRef && finalPaymentThrough !== 'Warehouse' && finalPaymentThrough !== 'WAREHOUSE') {
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
        const { sNo, mop, siteId, clientSiteName, clientName, expenseDate, amount, paymentThrough, purpose, paidBy, remarks, billVoucher, invoiceNo, claimStatus, paymentNote, vendorName, vendor, referenceNo } = req.body;

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

        if (!isPoWoRef && finalPaymentThrough !== 'Warehouse' && finalPaymentThrough !== 'WAREHOUSE') {
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

