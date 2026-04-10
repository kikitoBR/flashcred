import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { encrypt, decrypt } from '../utils/crypto';

const router = Router();

// GET /api/credentials - List all credentials for current user
router.get('/', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const userId = req.user?.id; // From authMiddleware

        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // Check global bank status
        const globalStatuses: any = await query(
            `SELECT bank_id, status FROM tenant_banks_status WHERE tenant_id = ?`,
            [tenantId]
        );
        const statusMap = new Map();
        globalStatuses.forEach((row: any) => statusMap.set(row.bank_id, row.status));

        const credentials: any = await query(
            `SELECT bank_id as bankId, login, password as password_enc, last_updated as lastUpdated FROM bank_credentials WHERE tenant_id = ? AND user_id = ?`,
            [tenantId, userId]
        );

        // Decrypt the passwords to send them back to the UI (as per current design)
        const decryptedCredentials = credentials.map((cred: any) => {
            let password = '';
            try {
                if (cred.password_enc) {
                    password = decrypt(cred.password_enc);
                }
            } catch (e) {
                console.error(`Failed to decrypt password for bank ${cred.bankId}`);
            }
            return {
                bankId: cred.bankId,
                login: cred.login,
                password,
                status: statusMap.get(cred.bankId) || 'ACTIVE', // Fallback to ACTIVE if global not set
                lastUpdated: cred.lastUpdated
            };
        });

        // Append global status for banks without credentials
        const returnedBankIds = new Set(decryptedCredentials.map((c: any) => c.bankId));
        statusMap.forEach((status, bankId) => {
            if (!returnedBankIds.has(bankId)) {
                decryptedCredentials.push({
                    bankId,
                    login: '',
                    password: '',
                    status,
                    lastUpdated: '-'
                });
            }
        });

        res.json(decryptedCredentials);
    } catch (error) {
        console.error('Error fetching credentials:', error);
        res.status(500).json({ error: 'Failed to fetch credentials' });
    }
});

// PUT /api/credentials/:bankId - Create or update credential for current user
router.put('/:bankId', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const userId = req.user?.id; // user might not be on req if not using proper auth?
        const bankId = req.params.bankId;
        const { login, password } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        if (!login) {
            return res.status(400).json({ error: 'Login is required' });
        }

        // Fetch current to conditionally update password
        const existing: any = await query(
            `SELECT id, password as password_enc FROM bank_credentials WHERE tenant_id = ? AND bank_id = ? AND user_id = ?`,
            [tenantId, bankId, userId]
        );

        let finalPasswordEnc = '';
        if (password && password.trim() !== '') {
            finalPasswordEnc = encrypt(password);
        } else if (existing.length > 0) {
            finalPasswordEnc = existing[0].password_enc;
        } else {
            return res.status(400).json({ error: 'Password is required for new credentials' });
        }

        if (existing.length > 0) {
            // Update
            await query(
                `UPDATE bank_credentials SET login = ?, password = ?, last_updated = CURRENT_TIMESTAMP WHERE tenant_id = ? AND bank_id = ? AND user_id = ?`,
                [login, finalPasswordEnc, tenantId, bankId, userId]
            );
        } else {
            // Insert
            const id = uuidv4();
            await query(
                `INSERT INTO bank_credentials (id, tenant_id, user_id, bank_id, login, password) VALUES (?, ?, ?, ?, ?, ?)`,
                [id, tenantId, userId, bankId, login, finalPasswordEnc]
            );
        }

        res.json({ message: 'Credentials saved successfully' });
    } catch (error) {
        console.error('Error saving credentials:', error);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

// PATCH /api/credentials/:bankId/status - Toggle GLOBAL bank status (Admins only)
router.patch('/:bankId/status', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const userRole = req.user?.role;
        const bankId = req.params.bankId;
        const { status } = req.body; // 'ACTIVE', 'INACTIVE'

        if (!userRole || !['admin', 'gerente'].includes(userRole)) {
            return res.status(403).json({ error: 'Apenas administradores e gerentes podem ativar/desativar bancos' });
        }

        if (!['ACTIVE', 'INACTIVE', 'INVALID', 'EXPIRED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const normalizedStatus = (status === 'ACTIVE') ? 'ACTIVE' : 'INACTIVE'; // Map EXPIRED/INVALID to INACTIVE

        const existing: any = await query(
            `SELECT id FROM tenant_banks_status WHERE tenant_id = ? AND bank_id = ?`,
            [tenantId, bankId]
        );

        if (existing.length > 0) {
            await query(
                `UPDATE tenant_banks_status SET status = ? WHERE tenant_id = ? AND bank_id = ?`,
                [normalizedStatus, tenantId, bankId]
            );
            res.json({ message: 'Status global atualizado com sucesso' });
        } else {
            const id = uuidv4();
            await query(
                `INSERT INTO tenant_banks_status (id, tenant_id, bank_id, status) VALUES (?, ?, ?, ?)`,
                [id, tenantId, bankId, normalizedStatus]
            );
            res.json({ message: 'Status global criado e atualizado' });
        }

    } catch (error) {
        console.error('Error updating credential status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

export default router;
