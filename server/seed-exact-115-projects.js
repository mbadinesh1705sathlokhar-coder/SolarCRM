const fs = require('fs');
const path = require('path');
const { conDb } = require('./database/database');
const { ProjectMaster } = require('./models/ProjectMaster');

async function seed115Projects() {
    try {
        console.log('Connecting to database...');
        await conDb.authenticate();
        console.log('Database connected.');

        const dataPath = path.join(__dirname, 'data', 'real115Projects.json');
        if (!fs.existsSync(dataPath)) {
            throw new Error('real115Projects.json not found at ' + dataPath);
        }

        const projects = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log(`Loaded ${projects.length} exact projects from JSON.`);

        if (projects.length !== 115) {
            throw new Error(`Expected exactly 115 projects, found ${projects.length}`);
        }

        // Empty ProjectMaster table
        console.log('Clearing all existing ProjectMaster records...');
        await ProjectMaster.destroy({ where: {}, truncate: true });

        console.log('Inserting exactly 115 projects...');
        for (const p of projects) {
            await ProjectMaster.create({
                id: p.id,
                awardedDate: p.awardedDate,
                siteId: p.siteId,
                clientName: p.clientName,
                location: p.location,
                contactNo: p.contactNo,
                emailId: p.emailId,
                address: p.address,
                siteCapacity: String(p.siteCapacity),
                siteValue: p.siteValue,
                siteType: p.siteType,
                systemType: p.systemType,
                siteCategory: p.siteCategory,
                clientType: p.clientType,
                saleType: p.saleType,
                orderBy: p.orderBy,
                received: p.received,
                siteExpenses: p.siteExpenses,
                materialsSupply: p.materialsSupply,
                installation: p.installation,
                ebProcess: p.ebProcess,
                documents: p.documents,
                warranty: p.warranty,
                handedOver: p.handedOver
            });
        }

        const count = await ProjectMaster.count();
        console.log(`Successfully seeded ${count} projects into ProjectMaster.`);

        // Financial totals verification
        const allProj = await ProjectMaster.findAll();
        const totalSiteValue = allProj.reduce((acc, p) => acc + (parseFloat(p.siteValue) || 0), 0);
        const totalReceived = allProj.reduce((acc, p) => acc + (parseFloat(p.received) || 0), 0);
        const totalDue = allProj.reduce((acc, p) => acc + (parseFloat(p.siteValue) - parseFloat(p.received) || 0), 0);
        const totalExpenses = allProj.reduce((acc, p) => acc + (parseFloat(p.siteExpenses) || 0), 0);
        const totalMargin = allProj.reduce((acc, p) => acc + (parseFloat(p.siteValue) - parseFloat(p.siteExpenses) || 0), 0);

        console.log('--- DASHBOARD VERIFICATION ---');
        console.log('Total Projects:', count);
        console.log('Total Site Value: ₹', totalSiteValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
        console.log('Total Received:   ₹', totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
        console.log('Total Due:        ₹', totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
        console.log('Total Expenses:   ₹', totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 }));
        console.log('Total Margin:     ₹', totalMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 }));

        process.exit(0);
    } catch (err) {
        console.error('Error seeding 115 projects:', err);
        process.exit(1);
    }
}

seed115Projects();
