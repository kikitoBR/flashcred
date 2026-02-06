import { pool } from '../database';
import { v4 as uuidv4 } from 'uuid';

const createCredentialsTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS bank_credentials (
            id CHAR(36) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL, -- Assuming tenant_id is string from existing schema
            bank_id VARCHAR(50) NOT NULL,
            login VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            cod_agente VARCHAR(100),
            cod_operador VARCHAR(100),
            status ENUM('ACTIVE', 'INVALID', 'EXPIRED') DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_tenant_bank (tenant_id, bank_id)
        );
    `;

    try {
        const connection = await pool.getConnection();
        await connection.query(createTableQuery);
        console.log('Table "bank_credentials" created or already exists.');
        connection.release();
        process.exit(0);
    } catch (error) {
        console.error('Error creating table:', error);
        process.exit(1);
    }
};

createCredentialsTable();
