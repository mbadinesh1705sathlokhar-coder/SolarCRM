const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const { rows } = require('./parse-expenses');
const { conDb } = require('./database/database');
const { OfficeVendor } = require('./models/OfficeVendor');
const { SiteExpenseLedger } = require('./models/SiteExpenseLedger');
const { VendorPoWo } = require('./models/VendorPoWo');
const { ProjectMaster, computeMetrics } = require('./models/ProjectMaster');

function parseToIsoDate(dateStr) {
    if (!dateStr) return new Date().toISOString().slice(0, 10);
    const trimmed = String(dateStr).trim();
    if (trimmed.includes('-')) {
        const parts = trimmed.split('-');
        if (parts.length === 3) {
            if (parts[0].length === 2 && parts[2].length === 4) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            if (parts[0].length === 4) {
                return trimmed;
            }
        }
    }
    return trimmed;
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

function extractSiteId(r) {
    if ((r.clientName && r.clientName.toLowerCase().includes('warehouse')) ||
        (r.poWoNo && (r.poWoNo.includes('/SWH/') || r.poWoNo.includes('/SHW/')))) {
        return 'WAREHOUSE';
    }
    if (r.clientName) {
        const cm = r.clientName.match(/^(SP\d+)\s*:/i);
        if (cm) return cm[1].toUpperCase();
    }
    if (r.poWoNo) {
        const pm = r.poWoNo.match(/SOLAR\/(?:SP\/)?([A-Z0-9]+)\//i);
        if (pm) {
            let sid = pm[1].toUpperCase();
            if (!sid.startsWith('SP') && !isNaN(sid)) {
                sid = 'SP' + sid;
            }
            return sid;
        }
    }
    return 'UNASSIGNED';
}

async function runMigration() {
    try {
        console.log('--- STARTING EXPENSES & VENDOR PO/WO MIGRATION ---');
        await conDb.authenticate();
        console.log('Database connected successfully.');

        // Step 1: Ensure MySQL schema modifications
        console.log('Updating MySQL table schema constraints...');
        await conDb.query('ALTER TABLE site_expense_ledgers MODIFY client_name VARCHAR(255) NULL DEFAULT ""');
        await conDb.query('ALTER TABLE vendor_po_wos MODIFY po_wo_number VARCHAR(100) NOT NULL');
        console.log('Schema constraints verified.');

        // Step 2: Ensure all vendors exist in OfficeVendor
        console.log('Checking OfficeVendor entries...');
        const existingVendors = await OfficeVendor.findAll();
        const vendorMap = new Map();
        for (const v of existingVendors) {
            vendorMap.set(v.vendorName.trim().toLowerCase(), v);
        }

        let newVendorsAdded = 0;
        for (const r of rows) {
            const vName = (r.vendorName || '').trim();
            if (!vName) continue;
            if (!vendorMap.has(vName.toLowerCase())) {
                const createdVendor = await OfficeVendor.create({
                    vendorName: vName,
                    salesCoordinator: '',
                    phoneNo: '',
                    location: 'Chennai',
                    materialsSpec: r.materials || '',
                    creditDays: '30 Days',
                    description: `Auto-registered vendor for ${r.materials || 'Solar Supplies'}`
                });
                vendorMap.set(vName.toLowerCase(), createdVendor);
                newVendorsAdded++;
                console.log(`Added new vendor to OfficeVendor: ${vName} (ID: ${createdVendor.id})`);
            }
        }
        console.log(`OfficeVendor check completed. New vendors created: ${newVendorsAdded}`);

        // Step 3: Synchronize SiteExpenseLedger
        console.log('Processing SiteExpenseLedger entries...');
        const allDbExpenses = await SiteExpenseLedger.findAll();
        const usedDbExpIds = new Set();

        let expensesUpdated = 0;
        let expensesCreated = 0;

        // Find max sNo
        let maxSNo = allDbExpenses.reduce((max, e) => Math.max(max, parseInt(e.sNo) || 0), 0);

        for (const r of rows) {
            const isoDate = parseToIsoDate(r.date);
            const mop = deriveMoP(isoDate);
            const amount = parseFloat((r.amountRaw || '').replace(/[₹,\s]/g, '')) || 0;
            const siteId = extractSiteId(r);
            const rawClient = (r.clientName || '').trim();
            const clientSiteName = rawClient;
            const clientName = rawClient; // Blank if empty, otherwise as provided

            // Match logic:
            // 1. Existing expense with this exact invoiceNo
            let match = allDbExpenses.find(e => e.invoiceNo === r.poWoNo);
            if (!match) {
                // 2. Exact match on date + amount + siteId
                match = allDbExpenses.find(e => !usedDbExpIds.has(e.id) && e.expenseDate === isoDate && Math.abs(parseFloat(e.amount) - amount) < 0.01 && e.siteId === siteId);
            }
            if (!match) {
                // 3. Fallback match on date + amount
                match = allDbExpenses.find(e => !usedDbExpIds.has(e.id) && e.expenseDate === isoDate && Math.abs(parseFloat(e.amount) - amount) < 0.01);
            }

            if (match) {
                usedDbExpIds.add(match.id);
                match.invoiceNo = r.poWoNo;
                match.vendorName = r.vendorName;
                match.paidBy = r.paidBy || 'OFFICE';
                match.billVoucher = r.billStatus || 'Not Submitted';
                match.claimStatus = r.billStatus || 'Not Submitted';
                match.category = r.materials;
                match.purpose = r.materials;
                match.paymentThrough = r.paymentThrough || 'P.O';
                match.referenceNo = r.poWoNo;
                match.siteId = siteId;
                match.mop = mop;
                if (rawClient) {
                    match.clientSiteName = clientSiteName;
                    match.clientName = clientName;
                }
                await match.save();
                expensesUpdated++;
            } else {
                maxSNo++;
                const newExp = await SiteExpenseLedger.create({
                    sNo: maxSNo,
                    mop: mop,
                    expenseDate: isoDate,
                    siteId: siteId,
                    clientSiteName: clientSiteName,
                    clientName: clientName,
                    amount: amount,
                    paymentThrough: r.paymentThrough || 'P.O',
                    purpose: r.materials || 'Consumables',
                    paidBy: r.paidBy || 'OFFICE',
                    remarks: r.materials || '',
                    billVoucher: r.billStatus || 'Not Submitted',
                    invoiceNo: r.poWoNo,
                    claimStatus: r.billStatus || 'Not Submitted',
                    category: r.materials || 'Materials Supply',
                    vendorName: r.vendorName,
                    referenceNo: r.poWoNo
                });
                usedDbExpIds.add(newExp.id);
                allDbExpenses.push(newExp);
                expensesCreated++;
            }
        }
        console.log(`SiteExpenseLedger sync complete: ${expensesUpdated} updated, ${expensesCreated} newly created.`);

        // Step 4: Synchronize VendorPoWo
        console.log('Processing VendorPoWo entries...');
        const existingPoWos = await VendorPoWo.findAll();
        const poWoMap = new Map();
        for (const p of existingPoWos) {
            poWoMap.set((p.poWoNumber || '').trim().toLowerCase(), p);
        }

        let poWosCreated = 0;
        let poWosUpdated = 0;

        for (const r of rows) {
            const vName = (r.vendorName || '').trim();
            const vendor = vendorMap.get(vName.toLowerCase());
            if (!vendor) {
                console.warn(`Vendor not found for row: ${vName}, PO: ${r.poWoNo}`);
                continue;
            }

            const isoDate = parseToIsoDate(r.date);
            const amount = parseFloat((r.amountRaw || '').replace(/[₹,\s]/g, '')) || 0;
            const rawClient = (r.clientName || '').trim();
            const poKey = (r.poWoNo || '').trim().toLowerCase();

            let poEntry = poWoMap.get(poKey);
            if (poEntry) {
                poEntry.vendorId = vendor.id;
                poEntry.vendorName = vendor.vendorName;
                poEntry.date = isoDate;
                poEntry.orderValue = amount;
                poEntry.materialDescription = r.materials;
                poEntry.clientName = rawClient;
                poEntry.orderType = r.paymentThrough || 'P.O';
                poEntry.generatedBy = r.paidBy;
                poEntry.billVoucherStatus = r.billStatus || 'Not Submitted';
                poEntry.invoiceNo = r.poWoNo;
                poEntry.remarks = r.materials;
                await poEntry.save();
                poWosUpdated++;
            } else {
                const newPo = await VendorPoWo.create({
                    vendorId: vendor.id,
                    vendorName: vendor.vendorName,
                    date: isoDate,
                    poWoNumber: r.poWoNo,
                    orderValue: amount,
                    materialDescription: r.materials,
                    clientName: rawClient,
                    orderType: r.paymentThrough || 'P.O',
                    generatedBy: r.paidBy,
                    billVoucherStatus: r.billStatus || 'Not Submitted',
                    invoiceNo: r.poWoNo,
                    remarks: r.materials
                });
                poWoMap.set(poKey, newPo);
                poWosCreated++;
            }
        }
        console.log(`VendorPoWo sync complete: ${poWosCreated} created, ${poWosUpdated} updated.`);

        // Step 5: Ensure ProjectMaster consistency and sync project expenses
        console.log('Synchronizing ProjectMaster expenses...');
        const uniqueSiteIds = new Set();
        for (const r of rows) {
            const sid = extractSiteId(r);
            if (sid && sid !== 'WAREHOUSE' && sid !== 'UNASSIGNED') {
                uniqueSiteIds.add(sid);
            }
        }

        let projCreated = 0;
        let projSynced = 0;

        for (const sid of uniqueSiteIds) {
            let proj = await ProjectMaster.findOne({ where: { siteId: sid } });
            if (!proj) {
                // Find any client name matching this site in the dataset
                const matchedRow = rows.find(r => extractSiteId(r) === sid && (r.clientName || '').trim().length > 0);
                const fullClientName = matchedRow ? matchedRow.clientName.trim() : `Site ${sid}`;

                // Extract capacity if available
                let cap = '5';
                const kwm = fullClientName.match(/(\d+(?:\.\d+)?)\s*KW/i);
                if (kwm) cap = kwm[1];

                // Extract location if available
                let loc = 'Chennai';
                const parts = fullClientName.split(',');
                if (parts.length >= 3) loc = parts[2].trim();

                proj = await ProjectMaster.create({
                    siteId: sid,
                    clientName: fullClientName,
                    location: loc,
                    siteCapacity: cap,
                    siteValue: 0.00,
                    received: 0.00,
                    due: 0.00,
                    siteExpenses: 0.00,
                    siteType: 'Residential',
                    systemType: 'Ongrid',
                    siteCategory: 'TATA SPG',
                    clientType: 'Individual',
                    saleType: 'B2C',
                    orderBy: 'OFFICE'
                });
                projCreated++;
                console.log(`Created baseline ProjectMaster entry for ${sid} (${fullClientName})`);
            }

            // Calculate total expenses for this site
            const totalExp = await SiteExpenseLedger.sum('amount', { where: { siteId: sid } }) || 0;
            proj.siteExpenses = parseFloat(Number(totalExp).toFixed(2));
            const metrics = computeMetrics(proj);
            proj.margin = metrics.margin;
            proj.marginPercentage = metrics.marginPercentage;
            await proj.save();
            projSynced++;
        }

        // Ensure WAREHOUSE is excluded from ProjectMaster
        await ProjectMaster.destroy({ where: { siteId: 'WAREHOUSE' } });

        console.log(`ProjectMaster sync complete: ${projCreated} new projects created, ${projSynced} projects synced with latest expenses.`);
        console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
