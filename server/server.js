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
const { Indent, IndentMaterial, WarehouseMaterial, GatePass, GatePassItem, CartItem } = require('./models/Inventory');
const { MasterList, MasterListItem } = require('./models/MasterList');
const { SitePlan } = require('./models/SitePlan');

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
const { seedLedgersIfEmpty } = require('./seedLedgers');
const { seedInitialLeadsIfEmpty } = require('./controllers/salesController');
const { seedContactsIfEmpty } = require('./controllers/contactsController');
const { seedCampaignsIfEmpty } = require('./controllers/campaignController');
const { seedOfficeIfEmpty } = require('./controllers/officeController');
const { seedInventoryIfEmpty } = require('./controllers/inventoryController');
const { seedMasterListsIfEmpty } = require('./controllers/masterListController');

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

const PORT = process.env.PORT || 2000;

// Initialize Database connection and sync models, then start server
async function startServer() {
    try {
        await Db();
        await conDb.sync();
        console.log('Database models synced successfully with MySQL.');

        await seedLedgersIfEmpty();
        await seedInitialLeadsIfEmpty();
        await seedContactsIfEmpty();
        await seedCampaignsIfEmpty();
        await seedOfficeIfEmpty();
        await seedInventoryIfEmpty();
        await seedMasterListsIfEmpty();

        app.listen(PORT, () => {
            console.log(`Server is running successfully on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
}

startServer();
