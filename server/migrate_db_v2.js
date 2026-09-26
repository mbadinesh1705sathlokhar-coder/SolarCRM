const { conDb } = require('./database/database');

async function run() {
    try {
        // 1. Add lead_by to project_masters if not exists
        const [cols1] = await conDb.query("SHOW COLUMNS FROM project_masters LIKE 'lead_by'");
        if (cols1.length === 0) {
            await conDb.query("ALTER TABLE project_masters ADD COLUMN lead_by VARCHAR(100) NULL AFTER order_by");
            console.log('Added lead_by column to project_masters');
        } else {
            console.log('lead_by column already exists in project_masters');
        }

        // 2. Add time to site_plans if not exists
        const [cols2] = await conDb.query("SHOW COLUMNS FROM site_plans LIKE 'time'");
        if (cols2.length === 0) {
            await conDb.query("ALTER TABLE site_plans ADD COLUMN time VARCHAR(20) DEFAULT '10:00' AFTER date");
            console.log('Added time column to site_plans');
        } else {
            console.log('time column already exists in site_plans');
        }

        // 3. Alter contact_meetings purpose column to VARCHAR(50)
        await conDb.query("ALTER TABLE contact_meetings MODIFY COLUMN purpose VARCHAR(50) NOT NULL DEFAULT 'Client'");
        console.log('Modified contact_meetings.purpose to VARCHAR(50)');

    } catch (e) {
        console.error('Migration error:', e);
    } finally {
        process.exit();
    }
}

run();
