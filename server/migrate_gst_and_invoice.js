const { conDb } = require('./database/database');

async function run() {
  try {
    const [cols] = await conDb.query('DESCRIBE office_vendors');
    const hasGst = cols.some(c => c.Field === 'gst_no');
    if (!hasGst) {
      await conDb.query('ALTER TABLE office_vendors ADD COLUMN gst_no VARCHAR(50) NULL DEFAULT NULL AFTER location');
      console.log('Added gst_no column to office_vendors successfully.');
    } else {
      console.log('gst_no column already exists in office_vendors.');
    }

    // Clean up PO/WO strings in invoice_no of site_expense_ledgers
    // Ensure reference_no has the PO/WO number, then clear invoice_no
    const [updateRes] = await conDb.query(`
      UPDATE site_expense_ledgers 
      SET reference_no = IF(reference_no IS NULL OR reference_no = '', invoice_no, reference_no),
          invoice_no = NULL
      WHERE invoice_no LIKE 'SOLAR/%' OR invoice_no LIKE '%/PO-%' OR invoice_no LIKE '%/WO-%'
    `);
    console.log('Cleared PO/WO numbers from invoice_no and ensured reference_no preserved.');
    console.log('Affected rows:', updateRes.affectedRows, 'Changed rows:', updateRes.changedRows);

    process.exit(0);
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(1);
  }
}

run();
