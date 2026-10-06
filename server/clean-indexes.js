const { conDb } = require('./database/database');

async function cleanIndexes() {
    try {
        await conDb.authenticate();
        const [tables] = await conDb.query('SHOW TABLES');

        for (const t of tables) {
            const tableName = Object.values(t)[0];
            const [indexes] = await conDb.query('SHOW INDEX FROM `' + tableName + '`');
            const byCol = {};
            for (const idx of indexes) {
                if (idx.Key_name === 'PRIMARY') continue;
                const col = idx.Column_name;
                if (!byCol[col]) byCol[col] = [];
                if (!byCol[col].includes(idx.Key_name)) byCol[col].push(idx.Key_name);
            }

            for (const col in byCol) {
                const keys = byCol[col];
                if (keys.length > 1) {
                    console.log(`Table ${tableName}, column ${col} has ${keys.length} indexes.`);
                    // Keep the first index, drop all the duplicates
                    for (let i = 1; i < keys.length; i++) {
                        const kName = keys[i];
                        try {
                            await conDb.query('ALTER TABLE `' + tableName + '` DROP INDEX `' + kName + '`');
                            console.log(`  Dropped ${kName} from ${tableName}`);
                        } catch (e) {
                            console.log(`  Could not drop ${kName} from ${tableName}:`, e.message);
                        }
                    }
                }
            }
        }

        console.log('Index cleanup completed.');
        process.exit(0);
    } catch (err) {
        console.error('Error cleaning indexes:', err);
        process.exit(1);
    }
}

cleanIndexes();
