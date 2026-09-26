const { conDb } = require('./database/database');

async function migrate() {
    try {
        await conDb.authenticate();
        console.log('Database connected.');
        const [cols] = await conDb.query('DESCRIBE sales_leads');
        const existing = cols.map(c => c.Field);
        console.log('Existing columns:', existing);

        const newCols = [
            { col: 'site_type', type: "VARCHAR(100) DEFAULT 'Residential'" },
            { col: 'system_type', type: "VARCHAR(100) DEFAULT 'Ongrid'" },
            { col: 'site_category', type: "VARCHAR(100) DEFAULT 'Rooftop'" },
            { col: 'sale_type', type: "VARCHAR(100) DEFAULT 'B2C'" },
            { col: 'client_type', type: "VARCHAR(100) DEFAULT 'Individual'" }
        ];

        for (const item of newCols) {
            if (!existing.includes(item.col)) {
                console.log(`Adding column ${item.col}...`);
                await conDb.query(`ALTER TABLE sales_leads ADD COLUMN ${item.col} ${item.type}`);
            } else {
                console.log(`Column ${item.col} already exists.`);
            }
        }

        const [updated] = await conDb.query('DESCRIBE sales_leads');
        console.log('Final columns:', updated.map(c => c.Field));
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
