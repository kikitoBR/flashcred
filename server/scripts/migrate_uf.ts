import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

async function runMigration() {
    try {
        console.log('🔗 Connecting to database...');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
        });

        console.log('🛠️ Adding column "uf" to table "vehicles"...');
        await connection.execute(`ALTER TABLE vehicles ADD COLUMN uf VARCHAR(2) DEFAULT NULL`);
        console.log('✅ Column added successfully!');

        await connection.end();
    } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️ Column "uf" already exists. Skipping.');
        } else {
            console.error('❌ Error applying migration:', error);
        }
    }
}

runMigration();
