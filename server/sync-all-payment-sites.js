const { conDb, Db } = require('./database/database');
const { ClientPaymentLedger } = require('./models/ClientPaymentLedger');
const { ProjectMaster } = require('./models/ProjectMaster');

async function syncAllPaymentSites() {
    try {
        await Db();
        await conDb.sync({ alter: true });

        // Fetch all payments
        const payments = await ClientPaymentLedger.findAll({ order: [['id', 'ASC']] });
        console.log(`Analyzing ${payments.length} payment records...`);

        // Group payments by siteId
        const siteData = {};
        for (const p of payments) {
            const sid = (p.siteId || '').trim();
            if (!sid) continue;

            if (!siteData[sid]) {
                siteData[sid] = {
                    total: 0,
                    clientName: p.clientName,
                    clientSiteName: p.clientSiteName,
                    firstDate: p.paymentDate
                };
            }
            siteData[sid].total += parseFloat(p.amount) || 0;
        }

        let updated = 0;
        let created = 0;

        for (const [siteId, info] of Object.entries(siteData)) {
            let project = await ProjectMaster.findOne({ where: { siteId } });

            if (!project) {
                // Parse capacity and location from clientSiteName
                // e.g. "SP261 : 3KW, Mr. Janakiraman, Kovur, Chennai"
                let capacity = '5';
                let location = 'Chennai';
                let clientName = info.clientName || 'Client ' + siteId;

                if (info.clientSiteName) {
                    const capMatch = info.clientSiteName.match(/(\d+(\.\d+)?)\s*KW/i);
                    if (capMatch) capacity = capMatch[1];

                    const commaParts = info.clientSiteName.split(',');
                    if (commaParts.length >= 3) {
                        location = commaParts.slice(2).join(', ').trim();
                    } else if (commaParts.length >= 2) {
                        location = commaParts[1].trim();
                    }
                }

                // Estimated site value: at least total received
                const estValue = Math.max(info.total, parseFloat(capacity) * 60000 || 200000);

                project = await ProjectMaster.create({
                    awardedDate: info.firstDate || '2026-01-09',
                    siteId,
                    clientName,
                    location,
                    contactNo: '',
                    emailId: '',
                    address: location,
                    siteCapacity: capacity,
                    siteValue: parseFloat(estValue.toFixed(2)),
                    siteType: 'Residential',
                    systemType: 'Waaree',
                    siteCategory: 'Rooftop',
                    clientType: 'Individual',
                    saleType: 'Direct Sale',
                    orderBy: 'K KARTHIKEYAN',
                    received: parseFloat(info.total.toFixed(2)),
                    siteExpenses: 0.00,
                    materialsSupply: true,
                    installation: true,
                    ebProcess: true,
                    documents: true,
                    warranty: false,
                    handedOver: false
                });
                created++;
            } else {
                project.received = parseFloat(info.total.toFixed(2));
                await project.save();
                updated++;
            }
        }

        console.log(`Synced ${updated} existing projects and created ${created} new projects from payment ledger.`);
        const totalProj = await ProjectMaster.count();
        console.log(`Total projects in ProjectMaster now: ${totalProj}`);

        process.exit(0);
    } catch (err) {
        console.error('Error syncing payment sites:', err);
        process.exit(1);
    }
}

syncAllPaymentSites();
