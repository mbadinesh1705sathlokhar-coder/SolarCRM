const fs = require('fs');
const path = require('path');
const { conDb, Db } = require('./database/database');
const { ClientPaymentLedger } = require('./models/ClientPaymentLedger');
const { ProjectMaster, computeMetrics } = require('./models/ProjectMaster');

async function seedRealPayments() {
    try {
        await Db();
        await conDb.sync({ alter: true });
        console.log('Database synced with ClientPaymentLedger model.');

        const dataPath = path.resolve(__dirname, 'data/realPaymentData.json');
        const paymentList = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

        console.log(`Loaded ${paymentList.length} real payments from JSON.`);

        // Clear existing payments table
        await ClientPaymentLedger.destroy({ where: {}, truncate: true });
        console.log('Cleared existing client_payment_ledgers table.');

        // Insert all real payments
        const inserted = await ClientPaymentLedger.bulkCreate(paymentList);
        console.log(`Successfully inserted ${inserted.length} real payment records into MySQL.`);

        // Aggregate by siteId
        const siteTotals = {};
        for (const p of paymentList) {
            if (!p.siteId) continue;
            const sid = p.siteId.trim();
            if (!siteTotals[sid]) {
                siteTotals[sid] = {
                    total: 0,
                    clientName: p.clientName,
                    clientSiteName: p.clientSiteName
                };
            }
            siteTotals[sid].total += parseFloat(p.amount) || 0;
        }

        console.log(`Distinct Sites with payments: ${Object.keys(siteTotals).length}`);

        // Sync each siteId with ProjectMaster
        let syncedCount = 0;
        let createdCount = 0;

        for (const [siteId, info] of Object.entries(siteTotals)) {
            const project = await ProjectMaster.findOne({ where: { siteId } });
            if (project) {
                project.received = parseFloat(info.total.toFixed(2));
                await project.save();
                syncedCount++;
            } else {
                console.log(`Site ${siteId} (${info.clientName}) has payments totaling ₹${info.total.toLocaleString('en-IN')} but is not yet in ProjectMaster.`);
            }
        }

        console.log(`Updated ProjectMaster.received for ${syncedCount} existing projects.`);

        // Total check
        const totalPaymentsSum = await ClientPaymentLedger.sum('amount');
        console.log(`Final Total Received in ClientPaymentLedger: ₹ ${parseFloat(totalPaymentsSum).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

        process.exit(0);
    } catch (err) {
        console.error('Error during payment seeding:', err);
        process.exit(1);
    }
}

seedRealPayments();
