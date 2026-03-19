
import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/clients
router.get('/', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const clients = await query('SELECT * FROM clients WHERE tenant_id = ? ORDER BY created_at DESC', [tenantId]);

        // Parse JSON fields
        const parsedClients = (clients as any[]).map(c => ({
            ...c,
            address: JSON.parse(c.address_json || '{}'),
            cnh: JSON.parse(c.cnh_json || '{}')
        }));

        res.json(parsedClients);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// POST /api/clients
router.post('/', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const { name, cpf, email, phone, income, address, cnh, birthDate, score } = req.body;

        const id = uuidv4();
        const addressJson = JSON.stringify(address || {});
        const cnhJson = JSON.stringify(cnh || {});

        await query(
            `INSERT INTO clients (id, tenant_id, name, cpf, email, phone, income, status, address_json, cnh_json, birth_date, score)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
            [id, tenantId, name, cpf, email, phone, income || 0, addressJson, cnhJson, birthDate || null, score || 0]
        );

        res.status(201).json({ id, message: 'Client created successfully' });
    } catch (error) {
        console.error('Error creating client:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const { name, cpf, email, phone, income, address, cnh, birthDate, score } = req.body;

        const addressJson = JSON.stringify(address || {});
        const cnhJson = JSON.stringify(cnh || {});

        await query(
            `UPDATE clients 
             SET name = ?, cpf = ?, email = ?, phone = ?, income = ?, address_json = ?, cnh_json = ?, birth_date = ?, score = ?
             WHERE id = ? AND tenant_id = ?`,
            [name, cpf, email, phone, income || 0, addressJson, cnhJson, birthDate || null, score || 0, id, tenantId]
        );

        res.json({ message: 'Client updated successfully' });
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

export default router;
