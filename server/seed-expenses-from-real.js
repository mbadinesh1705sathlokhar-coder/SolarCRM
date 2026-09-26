const fs = require('fs');
const path = require('path');
const { conDb } = require('./database/database');
const { ProjectMaster, computeMetrics } = require('./models/ProjectMaster');
const { SiteExpenseLedger } = require('./models/SiteExpenseLedger');

async function seedExpenses() {
    try {
        console.log('Connecting to database...');
        await conDb.authenticate();
        console.log('Database connected.');

        // Alter table to add new columns if not present
        await SiteExpenseLedger.sync({ alter: true });
        console.log('SiteExpenseLedger table schema synced.');

        const dataPath = path.join(__dirname, 'data', 'realExpenseData.json');
        if (!fs.existsSync(dataPath)) {
            throw new Error('realExpenseData.json not found at ' + dataPath);
        }

        const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log(`Loaded ${rawData.length} expense rows from JSON.`);

        // Step 1: Ensure all sites exist in ProjectMaster
        const siteAggregates = {};
        for (const row of rawData) {
            const sid = row.siteId || 'UNASSIGNED';
            if (!siteAggregates[sid]) {
                siteAggregates[sid] = {
                    siteId: sid,
                    clientSiteName: row.clientSiteName || sid,
                    clientName: row.clientName || sid,
                    totalExpenses: 0,
                    count: 0
                };
            }
            siteAggregates[sid].totalExpenses += (parseFloat(row.amount) || 0);
            siteAggregates[sid].count++;
        }

        console.log(`Found ${Object.keys(siteAggregates).length} unique sites in expense records.`);

        for (const [sId, agg] of Object.entries(siteAggregates)) {
            const existingProj = await ProjectMaster.findOne({ where: { siteId: sId } });
            if (!existingProj) {
                // Extract capacity if present in clientSiteName, e.g. "3KW" -> 3
                let cap = 5;
                const kwMatch = (agg.clientSiteName || '').match(/(\d+(?:\.\d+)?)\s*KW/i);
                if (kwMatch) cap = parseFloat(kwMatch[1]);

                // Guess a reasonable contract site value if none exists
                const estimatedValue = Math.max(agg.totalExpenses * 1.3, cap * 60000);

                console.log(`Creating baseline ProjectMaster entry for site ${sId} (${agg.clientName})...`);
                await ProjectMaster.create({
                    siteId: sId,
                    clientName: agg.clientName || 'Client ' + sId,
                    location: (agg.clientSiteName.split(',')[2] || 'Chennai').trim(),
                    siteCapacity: cap,
                    siteValue: parseFloat(estimatedValue.toFixed(2)),
                    siteType: 'Residential',
                    systemType: 'On Grid',
                    siteCategory: 'Tata SPG Order',
                    clientType: 'Individual',
                    saleType: 'B2C',
                    orderBy: 'K KARTHIKEYAN',
                    received: 0.00,
                    due: parseFloat(estimatedValue.toFixed(2)),
                    siteExpenses: 0.00,
                    margin: parseFloat(estimatedValue.toFixed(2)),
                    marginPercentage: 100.00,
                    status: 'Handed Over'
                });
            }
        }

        // Step 2: Clear old dummy expense records and insert all real expense records
        console.log('Clearing old expense entries...');
        await SiteExpenseLedger.destroy({ where: {}, truncate: true });

        console.log(`Inserting ${rawData.length} real expense records...`);
        const recordsToInsert = rawData.map(r => ({
            sNo: r.sNo,
            mop: r.mop || '',
            expenseDate: r.expenseDate,
            siteId: r.siteId,
            clientSiteName: r.clientSiteName || '',
            clientName: r.clientName || '',
            amount: r.amount,
            paymentThrough: r.paymentThrough || '',
            purpose: r.purpose || '',
            paidBy: r.paidBy || '',
            remarks: r.remarks || '',
            billVoucher: r.billVoucher || '',
            claimStatus: r.claimStatus || '',
            paymentNote: r.paymentNote || '',
            category: r.purpose || 'Materials Supply',
            vendorName: r.paidBy || '',
            description: r.remarks || '',
            referenceNo: r.paymentThrough || ''
        }));

        // Batch insert in chunks of 100
        const chunkSize = 100;
        for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
            const chunk = recordsToInsert.slice(i, i + chunkSize);
            await SiteExpenseLedger.bulkCreate(chunk);
        }
        console.log('All expense records inserted successfully.');

        // Step 3: Recalculate ProjectMaster.siteExpenses and margin for ALL projects
        console.log('Recalculating siteExpenses and margin for all projects...');
        const allProjects = await ProjectMaster.findAll();
        let totalProjectsUpdated = 0;

        for (const proj of allProjects) {
            const expSum = await SiteExpenseLedger.sum('amount', { where: { siteId: proj.siteId } }) || 0;
            const updatedExpenses = parseFloat(Number(expSum).toFixed(2));
            const metrics = computeMetrics({
                siteValue: proj.siteValue,
                received: proj.received,
                siteExpenses: updatedExpenses
            });

            await proj.update({
                siteExpenses: updatedExpenses,
                margin: metrics.margin,
                marginPercentage: metrics.marginPercentage,
                due: metrics.due
            });
            totalProjectsUpdated++;
        }

        console.log(`Updated financials for ${totalProjectsUpdated} projects in ProjectMaster.`);

        // Verification checks
        const finalCount = await SiteExpenseLedger.count();
        const finalSum = await SiteExpenseLedger.sum('amount');
        console.log(`Verification: Total Expense Rows = ${finalCount}, Total Expenses Sum = ₹ ${Number(finalSum).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

        process.exit(0);
    } catch (err) {
        console.error('Error during expense seeding:', err);
        process.exit(1);
    }
}

seedExpenses();
