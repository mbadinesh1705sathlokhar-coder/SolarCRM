const { conDb } = require('./database/database');

async function migrate() {
    try {
        await conDb.authenticate();
        console.log('Connected to MySQL successfully.');

        // 1. Add gst_percent to bom_material_masters
        try {
            await conDb.query('ALTER TABLE bom_material_masters ADD COLUMN gst_percent DECIMAL(5,2) DEFAULT 18.00');
            console.log('Added gst_percent to bom_material_masters');
        } catch (e) {
            console.log('bom_material_masters.gst_percent already exists or note:', e.message);
        }

        // Set default Panels GST to 12.00
        try {
            await conDb.query("UPDATE bom_material_masters SET gst_percent = 12.00 WHERE group_name = 'Panels'");
            console.log('Updated Panels gst_percent to 12.00');
        } catch (e) {
            console.log('Panels update note:', e.message);
        }

        // 2. Add transport_cost to inventory_gate_passes
        try {
            await conDb.query('ALTER TABLE inventory_gate_passes ADD COLUMN transport_cost DECIMAL(12,2) DEFAULT 0.00');
            console.log('Added transport_cost to inventory_gate_passes');
        } catch (e) {
            console.log('inventory_gate_passes.transport_cost already exists or note:', e.message);
        }

        // 3. Add dispatch_date to inventory_gate_pass_items
        try {
            await conDb.query('ALTER TABLE inventory_gate_pass_items ADD COLUMN dispatch_date DATE NULL');
            console.log('Added dispatch_date to inventory_gate_pass_items');
        } catch (e) {
            console.log('inventory_gate_pass_items.dispatch_date already exists or note:', e.message);
        }

        console.log('All migrations completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
