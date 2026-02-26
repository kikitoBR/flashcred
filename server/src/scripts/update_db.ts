
import { query } from '../database';

async function updateDb() {
    try {
        console.log('Updating database schema...');

        // Add columns if they don't exist
        try {
            await query("ALTER TABLE clients ADD COLUMN address_json JSON");
            console.log('Added address_json column.');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('address_json column already exists.');
            } else {
                console.error('Error adding address_json:', e);
            }
        }

        try {
            await query("ALTER TABLE vehicles ADD COLUMN version VARCHAR(255)");
            console.log('Added version column to vehicles.');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('version column already exists in vehicles.');
            } else {
                console.error('Error adding version to vehicles:', e);
            }
        }

        try {
            await query("ALTER TABLE clients ADD COLUMN cnh_json JSON");
            console.log('Added cnh_json column.');
        } catch (e: any) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('cnh_json column already exists.');
            } else {
                console.error('Error adding cnh_json:', e);
            }
        }

        // Ensure Birth Date column exists (user screenshot shows it)
        try {
            await query("ALTER TABLE clients ADD COLUMN birth_date DATE");
            console.log('Added birth_date column.');
        } catch (e: any) {
            console.log('birth_date column check skipped or failed (might exist).', e.message);
        }

        // --- FIPE Tables Creation ---
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS fipe_brands (
                    id INT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    vehicle_type VARCHAR(50) DEFAULT 'carros'
                )
            `);
            console.log('Created fipe_brands table.');

            await query(`
                CREATE TABLE IF NOT EXISTS fipe_models (
                    id INT PRIMARY KEY,
                    brand_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    FOREIGN KEY (brand_id) REFERENCES fipe_brands(id) ON DELETE CASCADE
                )
            `);
            console.log('Created fipe_models table.');

            await query(`
                CREATE TABLE IF NOT EXISTS fipe_years (
                    id VARCHAR(50) PRIMARY KEY, /* Format: yyyy-1 or yyyy-3 */
                    model_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL, /* e.g., '2015 Gasolina' */
                    year INT,
                    fuel INT,
                    FOREIGN KEY (model_id) REFERENCES fipe_models(id) ON DELETE CASCADE
                )
            `);
            console.log('Created fipe_years table.');

            await query(`
                CREATE TABLE IF NOT EXISTS fipe_versions (
                    id VARCHAR(100) PRIMARY KEY, /* Composite or Fipe ID */
                    model_id INT NOT NULL,
                    year_id VARCHAR(50) NOT NULL,
                    fipe_code VARCHAR(50),
                    name VARCHAR(255) NOT NULL,
                    price VARCHAR(50),
                    reference_month VARCHAR(50),
                    FOREIGN KEY (model_id) REFERENCES fipe_models(id) ON DELETE CASCADE,
                    FOREIGN KEY (year_id) REFERENCES fipe_years(id) ON DELETE CASCADE
                )
            `);
            console.log('Created fipe_versions table.');
        } catch (e: any) {
            console.error('Error creating FIPE tables:', e.message);
        }

    } catch (error) {
        console.error('Database update error:', error);
    }
    process.exit(0);
}

updateDb();
