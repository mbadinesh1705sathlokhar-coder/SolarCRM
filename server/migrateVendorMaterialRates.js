const { conDb } = require('./database/database');

async function migrate() {
    try {
        await conDb.authenticate();
        console.log('Database connected successfully.');

        // 1. Add material_rates column to office_vendors if it does not exist
        const [cols] = await conDb.query('DESCRIBE office_vendors');
        const colNames = cols.map(c => c.Field);
        if (!colNames.includes('material_rates')) {
            console.log('Adding material_rates column to office_vendors...');
            await conDb.query('ALTER TABLE office_vendors ADD COLUMN material_rates TEXT NULL AFTER materials_spec');
            console.log('Column material_rates added to office_vendors.');
        } else {
            console.log('Column material_rates already exists in office_vendors.');
        }

        // 2. Create vendor_material_rates table
        await conDb.query(`
            CREATE TABLE IF NOT EXISTS vendor_material_rates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_id INT NOT NULL,
                material_name VARCHAR(255) NOT NULL,
                rate DOUBLE NOT NULL DEFAULT 0.0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_vmr_vendor (vendor_id),
                CONSTRAINT fk_vmr_vendor FOREIGN KEY (vendor_id) REFERENCES office_vendors(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Table vendor_material_rates ensured.');

        const [vmrCols] = await conDb.query('DESCRIBE vendor_material_rates');
        console.log('vendor_material_rates schema:', vmrCols.map(c => ({ Field: c.Field, Type: c.Type })));
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
