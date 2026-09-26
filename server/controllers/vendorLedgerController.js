const { OfficeVendor } = require('../models/OfficeVendor');
const { VendorPoWo } = require('../models/VendorPoWo');
const { VendorPayment } = require('../models/VendorPayment');
const { SiteExpenseLedger } = require('../models/SiteExpenseLedger');
const { Op } = require('sequelize');

// --- GET ALL VENDORS (with PO/WO & Payment summary counts) ---
async function getAllVendors(req, res) {
    try {
        const vendors = await OfficeVendor.findAll({ order: [['vendorName', 'ASC']] });
        res.json({ success: true, data: vendors });
    } catch (err) {
        console.error('Error fetching vendors:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch vendors' });
    }
}

// --- GET SINGLE VENDOR WITH FULL LEDGER (PO/WO, Payments, Expenses Sync) ---
async function getVendorWithLedger(req, res) {
    try {
        const { id } = req.params;
        const vendor = await OfficeVendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        // Fetch PO/WOs (CR items)
        const poWos = await VendorPoWo.findAll({
            where: { vendorId: id },
            order: [['date', 'DESC'], ['id', 'DESC']]
        });

        // Fetch Payments Made (DR items)
        const payments = await VendorPayment.findAll({
            where: { vendorId: id },
            order: [['date', 'DESC'], ['id', 'DESC']]
        });

        // Fetch matching Expenses from SiteExpenseLedger by vendor name
        const vendorNameClean = vendor.vendorName.trim();
        let syncedExpenses = [];
        try {
            syncedExpenses = await SiteExpenseLedger.findAll({
                where: {
                    vendorName: { [Op.like]: `%${vendorNameClean}%` }
                },
                order: [['expenseDate', 'DESC']]
            });
        } catch (expErr) {
            console.warn('Error fetching synced expenses for vendor:', expErr.message);
        }

        // Auto-generate PO/WO records from matching Expenses Ledger entries
        const existingPoNums = new Set(poWos.map(p => (p.poWoNumber || '').trim().toLowerCase()));
        const expensePoWos = syncedExpenses.map(exp => {
            const voucher = (exp.billVoucher && exp.billVoucher !== 'Submitted' && exp.billVoucher !== 'Not Submitted')
                ? exp.billVoucher
                : (exp.paymentThrough ? `${exp.paymentThrough.replace(/\./g, '')}-${exp.id}` : `PO-${exp.id}`);
            return {
                id: `exp_${exp.id}`,
                expenseId: exp.id,
                vendorId: vendor.id,
                vendorName: vendor.vendorName,
                date: exp.expenseDate,
                poWoNumber: voucher,
                orderValue: parseFloat(exp.amount) || 0,
                materialDescription: exp.purpose || '',
                clientName: exp.clientName + (exp.siteId ? ` (${exp.siteId})` : ''),
                orderType: (exp.paymentThrough === 'W.O' || exp.paymentThrough === 'WO') ? 'W.O' : 'P.O',
                generatedBy: exp.paidBy || 'OFFICE',
                billVoucherStatus: exp.claimStatus || (exp.billVoucher === 'Submitted' ? 'Submitted' : 'Not Submitted'),
                invoiceNo: exp.invoiceNo || '',
                remarks: exp.remarks || '',
                source: 'Expenses Ledger'
            };
        }).filter(expPo => !existingPoNums.has(expPo.poWoNumber.toLowerCase()));

        // All PO/WOs combining Expenses Ledger + manual entries
        const combinedPoWos = [...poWos, ...expensePoWos];

        // Calculate Totals
        const totalCr = combinedPoWos.reduce((sum, item) => sum + (parseFloat(item.orderValue) || 0), 0);
        const totalDr = payments.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const dueToPay = Math.max(0, totalCr - totalDr);

        res.json({
            success: true,
            data: {
                vendor,
                poWos: combinedPoWos,
                payments,
                syncedExpenses,
                totalCr,
                totalDr,
                dueToPay
            }
        });
    } catch (err) {
        console.error('Error fetching vendor ledger:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch vendor ledger' });
    }
}

// --- CREATE VENDOR ---
async function createVendor(req, res) {
    try {
        const { vendorName, salesCoordinator, phoneNo, location, materialsSpec, creditDays, description } = req.body;
        if (!vendorName?.trim()) {
            return res.status(400).json({ success: false, message: 'Vendor Name is required.' });
        }
        const created = await OfficeVendor.create({
            vendorName: vendorName.trim(),
            salesCoordinator: salesCoordinator || 'Renuka',
            phoneNo: phoneNo || '',
            location: location || '',
            materialsSpec: Array.isArray(materialsSpec) ? materialsSpec.join(', ') : (materialsSpec || ''),
            creditDays: creditDays || '30 Days',
            description: description || ''
        });
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        console.error('Error creating vendor:', err);
        res.status(500).json({ success: false, message: 'Failed to create vendor' });
    }
}

// --- UPDATE VENDOR ---
async function updateVendor(req, res) {
    try {
        const { id } = req.params;
        const vendor = await OfficeVendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }
        const payload = { ...req.body };
        if (Array.isArray(payload.materialsSpec)) {
            payload.materialsSpec = payload.materialsSpec.join(', ');
        }
        await vendor.update(payload);

        // Also update vendorName in PO/WO and Payments if changed
        if (payload.vendorName && payload.vendorName !== vendor.vendorName) {
            await VendorPoWo.update({ vendorName: payload.vendorName }, { where: { vendorId: id } });
            await VendorPayment.update({ vendorName: payload.vendorName }, { where: { vendorId: id } });
        }

        res.json({ success: true, data: vendor });
    } catch (err) {
        console.error('Error updating vendor:', err);
        res.status(500).json({ success: false, message: 'Failed to update vendor' });
    }
}

// --- DELETE VENDOR ---
async function deleteVendor(req, res) {
    try {
        const { id } = req.params;
        const vendor = await OfficeVendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }
        await VendorPoWo.destroy({ where: { vendorId: id } });
        await VendorPayment.destroy({ where: { vendorId: id } });
        await vendor.destroy();
        res.json({ success: true, message: 'Vendor and associated records deleted successfully' });
    } catch (err) {
        console.error('Error deleting vendor:', err);
        res.status(500).json({ success: false, message: 'Failed to delete vendor' });
    }
}

// --- PO / WO CRUD ---
async function getVendorPoWos(req, res) {
    try {
        const { id } = req.params;
        const poWos = await VendorPoWo.findAll({
            where: { vendorId: id },
            order: [['date', 'DESC'], ['id', 'DESC']]
        });
        res.json({ success: true, data: poWos });
    } catch (err) {
        console.error('Error fetching PO/WOs:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch PO/WOs' });
    }
}

async function createVendorPoWo(req, res) {
    try {
        const { id } = req.params;
        const vendor = await OfficeVendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        const {
            date,
            poWoNumber,
            orderValue,
            materialDescription,
            clientName,
            orderType,
            generatedBy,
            billVoucherStatus,
            invoiceNo,
            remarks
        } = req.body;

        if (!poWoNumber?.trim()) {
            return res.status(400).json({ success: false, message: 'PO/WO Number is required.' });
        }

        const poWo = await VendorPoWo.create({
            vendorId: vendor.id,
            vendorName: vendor.vendorName,
            date: date || new Date().toISOString().split('T')[0],
            poWoNumber: poWoNumber.trim().substring(0, 20),
            orderValue: parseFloat(orderValue) || 0.00,
            materialDescription: Array.isArray(materialDescription) ? materialDescription.join(', ') : (materialDescription || ''),
            clientName: clientName || '',
            orderType: orderType || 'P.O',
            generatedBy: generatedBy || '',
            billVoucherStatus: billVoucherStatus || 'Not Submitted',
            invoiceNo: invoiceNo ? invoiceNo.trim() : null,
            remarks: remarks || ''
        });

        res.status(201).json({ success: true, data: poWo });
    } catch (err) {
        console.error('Error creating PO/WO:', err);
        res.status(500).json({ success: false, message: 'Failed to create PO/WO' });
    }
}

async function updateVendorPoWo(req, res) {
    try {
        const { id, poWoId } = req.params;
        const poWo = await VendorPoWo.findOne({ where: { id: poWoId, vendorId: id } });
        if (!poWo) {
            return res.status(404).json({ success: false, message: 'PO/WO record not found' });
        }

        const payload = { ...req.body };
        if (payload.poWoNumber) {
            payload.poWoNumber = payload.poWoNumber.trim().substring(0, 20);
        }
        if (Array.isArray(payload.materialDescription)) {
            payload.materialDescription = payload.materialDescription.join(', ');
        }
        if (payload.orderValue !== undefined) {
            payload.orderValue = parseFloat(payload.orderValue) || 0;
        }

        await poWo.update(payload);
        res.json({ success: true, data: poWo });
    } catch (err) {
        console.error('Error updating PO/WO:', err);
        res.status(500).json({ success: false, message: 'Failed to update PO/WO' });
    }
}

async function deleteVendorPoWo(req, res) {
    try {
        const { id, poWoId } = req.params;
        const poWo = await VendorPoWo.findOne({ where: { id: poWoId, vendorId: id } });
        if (!poWo) {
            return res.status(404).json({ success: false, message: 'PO/WO record not found' });
        }
        await poWo.destroy();
        res.json({ success: true, message: 'PO/WO record deleted successfully' });
    } catch (err) {
        console.error('Error deleting PO/WO:', err);
        res.status(500).json({ success: false, message: 'Failed to delete PO/WO' });
    }
}

// --- PAYMENTS MADE (DR) CRUD ---
async function getVendorPayments(req, res) {
    try {
        const { id } = req.params;
        const payments = await VendorPayment.findAll({
            where: { vendorId: id },
            order: [['date', 'DESC'], ['id', 'DESC']]
        });
        res.json({ success: true, data: payments });
    } catch (err) {
        console.error('Error fetching vendor payments:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch vendor payments' });
    }
}

async function createVendorPayment(req, res) {
    try {
        const { id } = req.params;
        const vendor = await OfficeVendor.findByPk(id);
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        const { date, amount, urnNumber, paymentMode, remarks } = req.body;
        const parsedAmount = parseFloat(amount) || 0;
        if (parsedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
        }

        const payment = await VendorPayment.create({
            vendorId: vendor.id,
            vendorName: vendor.vendorName,
            date: date || new Date().toISOString().split('T')[0],
            amount: parsedAmount,
            urnNumber: urnNumber || '',
            paymentMode: paymentMode || 'Bank Transfer / NEFT',
            remarks: remarks || ''
        });

        res.status(201).json({ success: true, data: payment });
    } catch (err) {
        console.error('Error creating vendor payment:', err);
        res.status(500).json({ success: false, message: 'Failed to record vendor payment' });
    }
}

async function updateVendorPayment(req, res) {
    try {
        const { id, paymentId } = req.params;
        const payment = await VendorPayment.findOne({ where: { id: paymentId, vendorId: id } });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        const payload = { ...req.body };
        if (payload.amount !== undefined) {
            payload.amount = parseFloat(payload.amount) || 0;
        }

        await payment.update(payload);
        res.json({ success: true, data: payment });
    } catch (err) {
        console.error('Error updating vendor payment:', err);
        res.status(500).json({ success: false, message: 'Failed to update vendor payment' });
    }
}

async function deleteVendorPayment(req, res) {
    try {
        const { id, paymentId } = req.params;
        const payment = await VendorPayment.findOne({ where: { id: paymentId, vendorId: id } });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }
        await payment.destroy();
        res.json({ success: true, message: 'Payment record deleted successfully' });
    } catch (err) {
        console.error('Error deleting vendor payment:', err);
        res.status(500).json({ success: false, message: 'Failed to delete vendor payment' });
    }
}

module.exports = {
    getAllVendors,
    getVendorWithLedger,
    createVendor,
    updateVendor,
    deleteVendor,
    getVendorPoWos,
    createVendorPoWo,
    updateVendorPoWo,
    deleteVendorPoWo,
    getVendorPayments,
    createVendorPayment,
    updateVendorPayment,
    deleteVendorPayment
};
