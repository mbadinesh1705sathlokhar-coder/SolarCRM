const { InvoiceBilling } = require('../models/InvoiceBilling');

// Get all Invoice Billing records
async function getAllInvoiceBillings(req, res) {
    try {
        const records = await InvoiceBilling.findAll({
            order: [['invoiceDate', 'DESC'], ['id', 'DESC']]
        });
        const data = records.map(r => {
            const json = r.toJSON();
            if (json.invoiceDocJson && typeof json.invoiceDocJson === 'string') {
                try {
                    json.invoiceDoc = JSON.parse(json.invoiceDocJson);
                } catch (e) {
                    json.invoiceDoc = null;
                }
            }
            return json;
        });
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error fetching invoice billings:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch invoice billings' });
    }
}

// Get next suggested Invoice No (e.g. 113/SOLAR/26-27)
async function getNextInvoiceNo(req, res) {
    try {
        const records = await InvoiceBilling.findAll({
            attributes: ['invoiceNo'],
            order: [['id', 'DESC']]
        });
        let maxNum = 112; // So first suggested is 113/SOLAR/26-27
        for (const r of records) {
            const m = (r.invoiceNo || '').match(/^(\d+)\//);
            if (m) {
                const n = parseInt(m[1], 10);
                if (!isNaN(n) && n > maxNum) {
                    maxNum = n;
                }
            }
        }
        const nextNum = maxNum + 1;
        const nextInvoiceNo = `${nextNum}/SOLAR/26-27`.substring(0, 20);
        res.json({ success: true, nextInvoiceNo });
    } catch (err) {
        console.error('Error generating next invoice number:', err);
        res.json({ success: true, nextInvoiceNo: '113/SOLAR/26-27' });
    }
}

// Create a new Invoice Billing record
async function createInvoiceBilling(req, res) {
    try {
        const {
            invoiceDate,
            invoiceNo,
            invoiceValue,
            clientName,
            invoiceType,
            billTo,
            siteId,
            approvalStatus,
            invoiceDoc
        } = req.body;

        if (!invoiceNo || !String(invoiceNo).trim()) {
            return res.status(400).json({ success: false, message: 'Invoice No is required.' });
        }
        if (!clientName || !String(clientName).trim()) {
            return res.status(400).json({ success: false, message: 'Client Name is required.' });
        }

        const validType = invoiceType === 'I&C Work' ? 'I&C Work' : 'Material Supply';
        const docStr = invoiceDoc
            ? (typeof invoiceDoc === 'object' ? JSON.stringify(invoiceDoc) : String(invoiceDoc))
            : null;

        const created = await InvoiceBilling.create({
            invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
            invoiceNo: String(invoiceNo).trim().substring(0, 20),
            invoiceValue: parseFloat(invoiceValue) || 0.0,
            clientName: String(clientName).trim().substring(0, 50),
            invoiceType: validType,
            billTo: billTo ? String(billTo).trim().substring(0, 200) : '',
            siteId: siteId ? String(siteId).trim().substring(0, 50) : null,
            approvalStatus: approvalStatus || 'Pending Approval',
            invoiceDocJson: docStr
        });

        const json = created.toJSON();
        json.invoiceDoc = invoiceDoc || null;
        res.status(201).json({ success: true, data: json });
    } catch (err) {
        console.error('Error creating invoice billing:', err);
        res.status(500).json({ success: false, message: 'Failed to create invoice billing' });
    }
}

// Update an existing Invoice Billing record
async function updateInvoiceBilling(req, res) {
    try {
        const { id } = req.params;
        const record = await InvoiceBilling.findByPk(id);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Invoice billing record not found' });
        }

        const payload = {};
        if (req.body.invoiceDate !== undefined) payload.invoiceDate = req.body.invoiceDate;
        if (req.body.invoiceNo !== undefined) payload.invoiceNo = String(req.body.invoiceNo).trim().substring(0, 20);
        if (req.body.invoiceValue !== undefined) payload.invoiceValue = parseFloat(req.body.invoiceValue) || 0.0;
        if (req.body.clientName !== undefined) payload.clientName = String(req.body.clientName).trim().substring(0, 50);
        if (req.body.invoiceType !== undefined) {
            payload.invoiceType = req.body.invoiceType === 'I&C Work' ? 'I&C Work' : 'Material Supply';
        }
        if (req.body.billTo !== undefined) payload.billTo = String(req.body.billTo || '').trim().substring(0, 200);
        if (req.body.siteId !== undefined) payload.siteId = req.body.siteId ? String(req.body.siteId).trim().substring(0, 50) : null;
        if (req.body.approvalStatus !== undefined) payload.approvalStatus = req.body.approvalStatus;
        if (req.body.invoiceDoc !== undefined) {
            payload.invoiceDocJson = req.body.invoiceDoc
                ? (typeof req.body.invoiceDoc === 'object' ? JSON.stringify(req.body.invoiceDoc) : String(req.body.invoiceDoc))
                : null;
        }

        await record.update(payload);
        const json = record.toJSON();
        if (json.invoiceDocJson) {
            try {
                json.invoiceDoc = JSON.parse(json.invoiceDocJson);
            } catch (e) {
                json.invoiceDoc = null;
            }
        }
        res.json({ success: true, data: json });
    } catch (err) {
        console.error('Error updating invoice billing:', err);
        res.status(500).json({ success: false, message: 'Failed to update invoice billing' });
    }
}

// Delete an Invoice Billing record
async function deleteInvoiceBilling(req, res) {
    try {
        const { id } = req.params;
        const record = await InvoiceBilling.findByPk(id);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Invoice billing record not found' });
        }
        await record.destroy();
        res.json({ success: true, message: 'Invoice billing record deleted successfully' });
    } catch (err) {
        console.error('Error deleting invoice billing:', err);
        res.status(500).json({ success: false, message: 'Failed to delete invoice billing' });
    }
}

// Bulk create Invoice Billing records (for Excel upload)
async function bulkCreateInvoiceBillings(req, res) {
    try {
        const { records } = req.body;
        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ success: false, message: 'No records provided for bulk import.' });
        }

        const toInsert = records.map((r, idx) => {
            const rawType = String(r.invoiceType || '').trim().toLowerCase();
            const validType = (rawType.includes('i&c') || rawType.includes('ic') || rawType.includes('install'))
                ? 'I&C Work'
                : 'Material Supply';
            return {
                invoiceDate: r.invoiceDate || new Date().toISOString().split('T')[0],
                invoiceNo: String(r.invoiceNo || `INV-${idx + 1}`).trim().substring(0, 20),
                invoiceValue: parseFloat(r.invoiceValue) || 0.0,
                clientName: String(r.clientName || 'Client').trim().substring(0, 50),
                invoiceType: validType,
                billTo: r.billTo ? String(r.billTo).trim().substring(0, 200) : '',
                siteId: r.siteId ? String(r.siteId).trim().substring(0, 50) : null,
                approvalStatus: 'Pending Approval',
                invoiceDocJson: r.invoiceDoc ? JSON.stringify(r.invoiceDoc) : null
            };
        });

        const created = await InvoiceBilling.bulkCreate(toInsert);
        res.status(201).json({ success: true, count: created.length, data: created });
    } catch (err) {
        console.error('Error bulk creating invoice billings:', err);
        res.status(500).json({ success: false, message: 'Failed to import invoice billing records' });
    }
}

module.exports = {
    getAllInvoiceBillings,
    getNextInvoiceNo,
    createInvoiceBilling,
    bulkCreateInvoiceBillings,
    updateInvoiceBilling,
    deleteInvoiceBilling
};
