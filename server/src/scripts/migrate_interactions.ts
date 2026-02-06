
import { pool } from '../database';

const migrateInteractions = async () => {
    try {
        console.log('Migrating database: Adding client_interactions table...');

        const connection = await pool.getConnection();

        await connection.query(`
            CREATE TABLE IF NOT EXISTS client_interactions (
                id VARCHAR(36) PRIMARY KEY,
                tenant_id VARCHAR(36) NOT NULL,
                client_id VARCHAR(36) NOT NULL,
                type ENUM('WHATSAPP', 'CALL', 'EMAIL', 'OTHER') DEFAULT 'WHATSAPP',
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            );
        `);

        console.log('Table client_interactions created/verified.');

        connection.release();
        console.log('Migration completed successfully.');
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateInteractions();
