const { conDb } = require('./database/database');
const { ProjectMaster } = require('./models/ProjectMaster');
const realData = require('./data/realProjectData.json');

async function seed() {
  try {
    await conDb.authenticate();
    console.log('Connected to MySQL for seeding...');

    // Clear old dummy data and reset table
    await ProjectMaster.destroy({ where: {}, truncate: true });
    console.log('Cleared existing records.');

    let inserted = 0;
    for (const data of realData) {
      await ProjectMaster.create(data);
      inserted++;
    }

    console.log(`Seeding completed successfully! Inserted ${inserted} real project records.`);
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await conDb.close();
  }
}

seed();
