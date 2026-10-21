const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const { conDb, Db } = require('./database/database');
const { ProjectMaster } = require('./models/ProjectMaster');
const { ClientPaymentLedger } = require('./models/ClientPaymentLedger');
const { SiteExpenseLedger } = require('./models/SiteExpenseLedger');
const { SalesLead } = require('./models/SalesLead');
const { Campaign, CampaignLead, CampaignExpense } = require('./models/Campaign');
const { Employee } = require('./models/Employee');
const { OfficeVendor } = require('./models/OfficeVendor');
const { VendorMaterialRate } = require('./models/VendorMaterialRate');
const { Indent, IndentMaterial, WarehouseMaterial, GatePass, GatePassItem, CartItem } = require('./models/Inventory');
const { MasterList, MasterListItem } = require('./models/MasterList');
const { SitePlan } = require('./models/SitePlan');
const { BomMaterialMaster } = require('./models/BomMaterialMaster');
const { InvoiceBilling } = require('./models/InvoiceBilling');

const projectRoutes = require('./routes/projectRoutes');
const ledgerRoutes = require('./routes/ledgerRoutes');
const salesRoutes = require('./routes/salesRoutes');
const contactsRoutes = require('./routes/contactsRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const officeRoutes = require('./routes/officeRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const masterListRoutes = require('./routes/masterListRoutes');
const sitePlanRoutes = require('./routes/sitePlanRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const bomMaterialRoutes = require('./routes/bomMaterialRoutes');
const invoiceBillingRoutes = require('./routes/invoiceBillingRoutes');
const { initReminderScheduler } = require('./services/reminderScheduler');
const { seedLedgersIfEmpty } = require('./seedLedgers');
const { seedInitialLeadsIfEmpty } = require('./controllers/salesController');
const { seedContactsIfEmpty } = require('./controllers/contactsController');
const { seedCampaignsIfEmpty } = require('./controllers/campaignController');
const { seedOfficeIfEmpty } = require('./controllers/officeController');
const { seedInventoryIfEmpty } = require('./controllers/inventoryController');
const { seedMasterListsIfEmpty } = require('./controllers/masterListController');
const { seedBomMaterialsIfEmpty } = require('./controllers/bomMaterialController');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Root healthcheck
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'Solar Project Management API is running',
        database: process.env.DATABASE_NAME
    });
});

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/office', officeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/master-lists', masterListRoutes);
app.use('/api/site-plans', sitePlanRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bom-materials', bomMaterialRoutes);
app.use('/api/invoice-billings', invoiceBillingRoutes);

const PORT = process.env.PORT || 2000;

const fs = require('fs');

async function seedProjectsIfEmpty() {
    try {
        const count = await ProjectMaster.count();
        if (count === 0) {
            console.log('Seeding initial 115 projects into ProjectMaster...');
            const dataPath = path.join(__dirname, 'data', 'real115Projects.json');
            if (fs.existsSync(dataPath)) {
                const projects = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
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
                console.log(`Successfully auto-seeded ${projects.length} real projects into ProjectMaster.`);
            }
        }
    } catch (err) {
        console.error('Error auto-seeding projects:', err);
    }
}

async function ensureInventoryColumns() {
    try {
        const qi = conDb.getQueryInterface();
        const checkAndAdd = async (table, col, def) => {
            try {
                const cols = await qi.describeTable(table);
                if (!cols[col]) {
                    await conDb.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def};`);
                }
            } catch (e) {}
        };
        await checkAndAdd('inventory_warehouse_materials', 'material_group', 'VARCHAR(150) NULL');
        await checkAndAdd('inventory_warehouse_materials', 'category_type', 'VARCHAR(150) NULL');
        await checkAndAdd('inventory_warehouse_materials', 'specification', 'VARCHAR(255) NULL');
        await checkAndAdd('inventory_gate_pass_items', 'material_group', 'VARCHAR(150) NULL');
        await checkAndAdd('inventory_gate_pass_items', 'category_type', 'VARCHAR(150) NULL');
        await checkAndAdd('inventory_gate_pass_items', 'specification', 'VARCHAR(255) NULL');
        await checkAndAdd('inventory_gate_pass_items', 'po_wo_no', 'VARCHAR(100) NULL');
        await checkAndAdd('inventory_gate_passes', 'po_wo_no', 'VARCHAR(100) NULL');
        await checkAndAdd('inventory_cart_items', 'invoice_no', 'VARCHAR(100) NULL');
        await checkAndAdd('inventory_cart_items', 'po_wo_no', 'VARCHAR(100) NULL');
        await checkAndAdd('inventory_inward_items', 'material_group', 'VARCHAR(150) NULL');
        await checkAndAdd('inventory_inward_items', 'category_type', 'VARCHAR(150) NULL');
        await checkAndAdd('inventory_inward_items', 'specification', 'VARCHAR(255) NULL');
        // Vendor Bank Account Columns
        await checkAndAdd('office_vendors', 'account_number', 'VARCHAR(100) NULL');
        await checkAndAdd('office_vendors', 'cc_acc_no', 'VARCHAR(100) NULL');
        await checkAndAdd('office_vendors', 'bank_name', 'VARCHAR(150) NULL');
        await checkAndAdd('office_vendors', 'ifsc_code', 'VARCHAR(50) NULL');
        await checkAndAdd('office_vendors', 'branch', 'VARCHAR(150) NULL');
    } catch (e) {
        console.error('Error in ensureInventoryColumns:', e);
    }
}

// Initialize Database connection and sync models, then start server
async function startServer() {
    let connected = false;
    while (!connected) {
        try {
            await Db();
            await conDb.sync();
            await ensureInventoryColumns();
            console.log('Database models synced successfully with MySQL.');
            connected = true;
        } catch (err) {
            console.error('MySQL connection failed (is MySQL80 running?). Retrying in 5 seconds...', err.message || err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    try {
        await seedProjectsIfEmpty();
        await seedLedgersIfEmpty();
        await seedInitialLeadsIfEmpty();
        await seedContactsIfEmpty();
        await seedCampaignsIfEmpty();
        await seedOfficeIfEmpty();
        await seedInventoryIfEmpty();
        await seedMasterListsIfEmpty();
        await seedBomMaterialsIfEmpty();

        initReminderScheduler();

        app.listen(PORT, () => {
            console.log(`Server is running successfully on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to initialize server after DB connection:', err);
        process.exit(1);
    }
}

startServer();
