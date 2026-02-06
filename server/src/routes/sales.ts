
import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/sales - List all sales for tenant
router.get('/', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const sales = await query(
            `SELECT * FROM sales WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
            [tenantId]
        );
        res.json(sales);
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// GET /api/sales/simulations - Get all simulations history
router.get('/simulations', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const simulations = await query(
            `SELECT * FROM simulations WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100`,
            [tenantId]
        );
        res.json(simulations);
    } catch (error) {
        console.error('Error fetching simulations:', error);
        res.status(500).json({ error: 'Failed to fetch simulations' });
    }
});

// GET /api/sales/opportunities - Get opportunities (Remarketing/Retry)
router.get('/opportunities', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;

        // Remarketing: Approved simulations from > 3 (arbitrary) days ago
        const remarketing = await query(
            `SELECT id, client_name as name, vehicle_description as car, created_at as date, status, 
                    client_cpf as cpf, 'N/A' as phone, 0 as income, 'N/A' as email
             FROM simulations 
             WHERE tenant_id = ? AND status = 'APPROVED' AND created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
             LIMIT 50`,
            [tenantId]
        );

        // Retry: Rejected simulations from > 7 days ago
        const retry = await query(
            `SELECT id, client_name as name, vehicle_description as car, created_at as date, 
                    client_cpf as cpf, 'N/A' as phone, 0 as income, 'N/A' as email
             FROM simulations 
             WHERE tenant_id = ? AND status LIKE 'REJECT%' AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
             LIMIT 50`,
            [tenantId]
        );

        res.json({ remarketing, retry });
    } catch (error) {
        console.error('Error fetching opportunities:', error);
        res.status(500).json({ error: 'Failed to fetch opportunities' });
    }
});

// GET /api/sales/stats - Get sales statistics
router.get('/stats', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const today = new Date().toISOString().split('T')[0];

        // Basic KPI counts
        const [todaySims] = await query(
            `SELECT COUNT(*) as count FROM simulations WHERE tenant_id = ? AND DATE(created_at) = ?`,
            [tenantId, today]
        ) as any[];

        const [todayApprovals] = await query(
            `SELECT COUNT(*) as count FROM simulations WHERE tenant_id = ? AND DATE(created_at) = ? AND status = 'APPROVED'`,
            [tenantId, today]
        ) as any[];

        const [totalFinanced] = await query(
            `SELECT COALESCE(SUM(financed_value), 0) as total FROM sales WHERE tenant_id = ? AND status = 'FINALIZED'`,
            [tenantId]
        ) as any[];

        // Monthly Performance (last 5 months sales)
        // Note: Using hardcoded months if no data exists could be an option, but let's try real data.
        const monthlyData = await query(
            `SELECT DATE_FORMAT(sale_date, '%b') as name, SUM(financed_value) as value 
             FROM sales 
             WHERE tenant_id = ? AND sale_date >= DATE_SUB(NOW(), INTERVAL 5 MONTH)
             GROUP BY DATE_FORMAT(sale_date, '%Y-%m'), DATE_FORMAT(sale_date, '%b')
             ORDER BY DATE_FORMAT(sale_date, '%Y-%m')`,
            [tenantId]
        );

        // Bank Performance
        const bankData = await query(
            `SELECT bank_name as name, 
                    SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as aprovados,
                    SUM(CASE WHEN status = 'REJECTED' OR status = 'Reprovado' THEN 1 ELSE 0 END) as reprovados
             FROM simulations 
             WHERE tenant_id = ? 
             GROUP BY bank_name`,
            [tenantId]
        );

        res.json({
            todaySimulations: todaySims?.count || 0,
            todayApprovals: todayApprovals?.count || 0,
            totalFinanced: totalFinanced?.total || 0,
            monthlyPerformance: monthlyData,
            bankPerformance: bankData
        });
    } catch (error) {
        console.error('Error fetching sales stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// POST /api/sales - Create a new sale
router.post('/', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const {
            clientId, clientName, clientCpf, vehicleId, vehicleDescription,
            bankId, bankName, financedValue, downPayment, installments,
            monthlyPayment, interestRate, status, saleDate
        } = req.body;

        const id = uuidv4();

        await query(
            `INSERT INTO sales (id, tenant_id, client_id, client_name, client_cpf, vehicle_id, vehicle_description, 
             bank_id, bank_name, financed_value, down_payment, installments, monthly_payment, interest_rate, status, sale_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, tenantId, clientId, clientName, clientCpf, vehicleId, vehicleDescription,
                bankId, bankName, financedValue, downPayment || 0, installments || 48,
                monthlyPayment, interestRate, status || 'FINALIZED', saleDate || new Date()]
        );

        res.status(201).json({ id, message: 'Sale registered successfully' });
    } catch (error) {
        console.error('Error creating sale:', error);
        res.status(500).json({ error: 'Failed to create sale' });
    }
});

// POST /api/sales/simulation - Log a simulation attempt
router.post('/simulation', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const {
            clientId, clientName, clientCpf, vehicleId, vehicleDescription,
            bankId, bankName, status, resultData
        } = req.body;

        const id = uuidv4();

        await query(
            `INSERT INTO simulations (id, tenant_id, client_id, client_name, client_cpf, vehicle_id, vehicle_description, 
             bank_id, bank_name, status, result_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, tenantId, clientId, clientName, clientCpf, vehicleId, vehicleDescription,
                bankId, bankName, status || 'PENDING', JSON.stringify(resultData || {})]
        );

        res.status(201).json({ id, message: 'Simulation logged successfully' });
    } catch (error) {
        console.error('Error logging simulation:', error);
        res.status(500).json({ error: 'Failed to log simulation' });
    }
});

export default router;
