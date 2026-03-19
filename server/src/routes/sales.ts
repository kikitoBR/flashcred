
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

        // Remarketing: Approved simulations from > 5 minutes ago that DO NOT have a finalized sale
        const remarketing = await query(
            `SELECT s.id, s.client_name as name, s.vehicle_description as car, s.created_at as date, s.status, 
                    s.client_cpf as cpf, 'N/A' as phone, 0 as income, 'N/A' as email
             FROM simulations s
             WHERE s.tenant_id = ? 
               AND s.status = 'APPROVED' 
               AND s.created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)
               AND NOT EXISTS (
                   SELECT 1 FROM sales sa 
                   WHERE sa.tenant_id = s.tenant_id 
                     AND sa.client_cpf = s.client_cpf 
                     AND sa.status = 'FINALIZED'
               )
             LIMIT 50`,
            [tenantId]
        );

        // Retry: Rejected simulations from > 10 minutes ago (adjusted for testing)
        const retry = await query(
            `SELECT id, client_name as name, vehicle_description as car, created_at as date, 
                    client_cpf as cpf, 'N/A' as phone, 0 as income, 'N/A' as email
             FROM simulations 
             WHERE tenant_id = ? AND status LIKE 'REJECT%' AND created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
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
        const [totalSims] = await query(
            `SELECT COUNT(*) as count FROM simulations WHERE tenant_id = ?`,
            [tenantId]
        ) as any[];

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
        // ... rest of the code is unchanged ...
        const monthlyData = await query(
            `SELECT DATE_FORMAT(sale_date, '%b') as name, SUM(financed_value) as value 
             FROM sales 
             WHERE tenant_id = ? AND sale_date >= DATE_SUB(NOW(), INTERVAL 5 MONTH)
             GROUP BY DATE_FORMAT(sale_date, '%Y-%m'), DATE_FORMAT(sale_date, '%b')
             ORDER BY DATE_FORMAT(sale_date, '%Y-%m')`,
            [tenantId]
        );

        // Bank Performance via JSON Parsing of result_data
        const simulationsRaw = await query(
            `SELECT bank_name, status, result_data FROM simulations WHERE tenant_id = ?`,
            [tenantId]
        ) as any[];

        const bankStatsMap: Record<string, { aprovados: number, reprovados: number }> = {};

        // Helper map to match bank IDs to names
        const bankNameMap: Record<string, string> = {
            '1': 'Banco Itaú',
            '2': 'Bradesco Financiamentos',
            '3': 'Santander',
            '4': 'BV Financeira',
            '5': 'Banco Pan',
            '6': 'C6 Bank',
            '7': 'Banco Safra',
            '8': 'Daycoval',
            '9': 'Omni Financeira'
        };

        simulationsRaw.forEach(sim => {
            if (sim.bank_name === 'Múltiplos Bancos' || sim.bank_name === 'MULTIBANK') {
                try {
                    const resultData = typeof sim.result_data === 'string' ? JSON.parse(sim.result_data) : sim.result_data;
                    if (resultData && resultData.offers && Array.isArray(resultData.offers)) {
                        resultData.offers.forEach((offer: any) => {
                            if (!offer.bankId) return;
                            const bName = bankNameMap[offer.bankId] || `Banco ${offer.bankId}`;
                            if (!bankStatsMap[bName]) {
                                bankStatsMap[bName] = { aprovados: 0, reprovados: 0 };
                            }
                            if (offer.status === 'APPROVED') {
                                bankStatsMap[bName].aprovados++;
                            } else {
                                bankStatsMap[bName].reprovados++;
                            }
                        });
                    }
                } catch (e) {
                    console.error('Error parsing resultData for bank stats:', e);
                }
            } else {
                // Ensure older pre-MULTIBANK records are also counted
                if (!bankStatsMap[sim.bank_name]) {
                    bankStatsMap[sim.bank_name] = { aprovados: 0, reprovados: 0 };
                }
                if (sim.status === 'APPROVED') {
                    bankStatsMap[sim.bank_name].aprovados++;
                } else if (sim.status === 'REJECTED' || sim.status === 'Reprovado') {
                    bankStatsMap[sim.bank_name].reprovados++;
                }
            }
        });

        const bankData = Object.entries(bankStatsMap).map(([name, stats]) => ({
            name,
            aprovados: stats.aprovados,
            reprovados: stats.reprovados
        }));

        res.json({
            totalSimulations: totalSims?.count || 0,
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
            [
                id,
                tenantId,
                clientId || null,
                clientName || 'Cliente',
                clientCpf || null,
                vehicleId || null,
                vehicleDescription || null,
                bankId || 'MULTIBANK',
                bankName || 'Múltiplos Bancos',
                status || 'PENDING',
                JSON.stringify(resultData || {})
            ]
        );

        res.status(201).json({ id, message: 'Simulation logged successfully' });
    } catch (error) {
        console.error('Error logging simulation:', error);
        res.status(500).json({ error: 'Failed to log simulation' });
    }
});

export default router;
