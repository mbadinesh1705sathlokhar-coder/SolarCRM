const path = require('path');
const dotenv = require('dotenv');
const { Sequelize } = require('sequelize');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const conDb = new Sequelize(
    process.env.DATABASE_NAME,
    process.env.DATABASE_USER,
    process.env.DATABASE_PASS,
    {
        host: process.env.DATABASE_HOST,
        dialect: process.env.DATABASE_DIALECT || 'mysql',
        port: process.env.DATABASE_PORT || 3306,
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

async function Db() {
    try {
        await conDb.authenticate();
        console.log('MySQL connected successfully to database:', process.env.DATABASE_NAME);
    } catch (err) {
        console.error('Database connection error:', err);
        throw err;
    }
}

module.exports = { conDb, Db };