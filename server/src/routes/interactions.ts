
import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/interactions/:clientId - Get interactions for a client
router.get('/:clientId', async (req: any, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const { clientId } = req.params;

        const interactions = await query(
            `SELECT * FROM client_interactions 
             WHERE tenant_id = ? AND client_id = ? 
             ORDER BY created_at DESC`,
            [tenantId, clientId]
        );

        res.json(interactions);
    } catch (error) {
        console.error('Error fetching interactions:', error);
        res.status(500).json({ error: 'Failed to fetch interactions' });
    }
});

// POST /api/interactions - Register a new interaction
router.post('/', async (req: any, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const { clientId, type, note } = req.body;

        if (!clientId) {
            return res.status(400).json({ error: 'Missing clientId' });
        }

        const id = uuidv4();

        await query(
            `INSERT INTO client_interactions (id, tenant_id, client_id, type, note)
             VALUES (?, ?, ?, ?, ?)`,
            [id, tenantId, clientId, type || 'WHATSAPP', note || '']
        );

        res.status(201).json({ id, message: 'Interaction logged successfully' });

    } catch (error) {
        console.error('Error logging interaction:', error);
        res.status(500).json({ error: 'Failed to log interaction' });
    }
});

export default router;
