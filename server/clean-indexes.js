const { conDb } = require('./database/database');

async function cleanIndexes() {
    try {
        await conDb.authenticate();
        const [results] = await conDb.query('SHOW INDEX FROM project_masters');
        console.log('Total indexes on project_masters:', results.length);
        const siteIdIndexes = results.filter(r => r.Column_name === 'site_id' && r.Key_name !== 'PRIMARY');
        console.log('Site ID indexes found:', siteIdIndexes.length);

        const keyNames = Array.from(new Set(siteIdIndexes.map(r => r.Key_name)));
        console.log('Distinct key names:', keyNames.length);

        for (let i = 1; i < keyNames.length; i++) {
            const kName = keyNames[i];
            try {
                await conDb.query('ALTER TABLE `project_masters` DROP INDEX `' + kName + '`');
            } catch (e) {
                console.log('Could not drop ' + kName + ':', e.message);
            }
        }

        const [after] = await conDb.query('SHOW INDEX FROM project_masters');
        console.log('Remaining indexes on project_masters:', after.length);
        process.exit(0);
    } catch (err) {
        console.error('Error cleaning indexes:', err);
        process.exit(1);
    }
}

cleanIndexes();
