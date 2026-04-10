
import { query } from '../database';

async function addSimulationIdToSales() {
    try {
        console.log('Running migration: add simulation_id and user_id to sales...');

        // Add simulation_id column if not exists
        try {
            await query(`ALTER TABLE sales ADD COLUMN simulation_id VARCHAR(36) DEFAULT NULL`);
            console.log('✅ Column simulation_id added.');
        } catch (e: any) {
            if (e.message?.includes('Duplicate column')) {
                console.log('ℹ️ Column simulation_id already exists.');
            } else {
                throw e;
            }
        }

        // Add user_id column if not exists
        try {
            await query(`ALTER TABLE sales ADD COLUMN user_id VARCHAR(36) DEFAULT NULL`);
            console.log('✅ Column user_id added.');
        } catch (e: any) {
            if (e.message?.includes('Duplicate column')) {
                console.log('ℹ️ Column user_id already exists.');
            } else {
                throw e;
            }
        }

        // Add index on simulation_id
        try {
            await query(`ALTER TABLE sales ADD INDEX idx_simulation (simulation_id)`);
            console.log('✅ Index idx_simulation added.');
        } catch (e: any) {
            if (e.message?.includes('Duplicate key name')) {
                console.log('ℹ️ Index idx_simulation already exists.');
            } else {
                throw e;
            }
        }

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    }
    process.exit(0);
}

addSimulationIdToSales();
