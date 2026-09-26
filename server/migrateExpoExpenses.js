const { conDb } = require('./database/database');

async function migrate() {
    try {
        await conDb.authenticate();
        console.log('Database connected.');
        const [cols] = await conDb.query('DESCRIBE campaign_expenses');
        const existing = cols.map(c => c.Field);
        console.log('Existing columns in campaign_expenses:', existing);

        if (!existing.includes('paid_by')) {
            console.log('Adding column paid_by...');
            await conDb.query("ALTER TABLE campaign_expenses ADD COLUMN paid_by VARCHAR(100) DEFAULT 'OFFICE'");
            console.log('Column paid_by added successfully.');
        } else {
            console.log('Column paid_by already exists.');
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
