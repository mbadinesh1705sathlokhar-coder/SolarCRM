const { conDb } = require('./database/database');
const { ProjectMaster } = require('./models/ProjectMaster');
const { ClientPaymentLedger } = require('./models/ClientPaymentLedger');
const { SiteExpenseLedger } = require('./models/SiteExpenseLedger');

async function seedLedgersIfEmpty() {
    try {
        const paymentCount = await ClientPaymentLedger.count();
        const expenseCount = await SiteExpenseLedger.count();

        if (paymentCount === 0 || expenseCount === 0) {
            console.log('Seeding initial ledger entries from ProjectMaster...');
            const projects = await ProjectMaster.findAll({ order: [['id', 'ASC']] });

            const paymentsToCreate = [];
            const expensesToCreate = [];

            for (const p of projects) {
                const recv = parseFloat(p.received) || 0;
                const exp = parseFloat(p.siteExpenses) || 0;
                const pDate = p.awardedDate || '2026-04-01';

                if (paymentCount === 0 && recv > 0) {
                    paymentsToCreate.push({
                        siteId: p.siteId,
                        clientName: p.clientName,
                        paymentDate: pDate,
                        amount: recv,
                        paymentMode: 'Bank Transfer / NEFT',
                        remarks: 'Initial Milestone Payment',
                        referenceNo: 'INIT-' + p.siteId
                    });
                }

                if (expenseCount === 0 && exp > 0) {
                    expensesToCreate.push({
                        siteId: p.siteId,
                        clientName: p.clientName,
                        expenseDate: pDate,
                        amount: exp,
                        category: 'Materials Supply',
                        vendorName: 'Primary Vendor',
                        description: 'Initial Site Materials & Execution Expense',
                        referenceNo: 'EXP-INIT-' + p.siteId
                    });
                }
            }

            if (paymentsToCreate.length > 0) {
                await ClientPaymentLedger.bulkCreate(paymentsToCreate);
                console.log('Seeded ' + paymentsToCreate.length + ' initial client payments.');
            }

            if (expensesToCreate.length > 0) {
                await SiteExpenseLedger.bulkCreate(expensesToCreate);
                console.log('Seeded ' + expensesToCreate.length + ' initial site expenses.');
            }
        }
    } catch (err) {
        console.error('Error seeding ledgers:', err);
    }
}

module.exports = { seedLedgersIfEmpty };
