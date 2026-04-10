
import { Router } from 'express';
import { query } from '../database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/sales - List all sales for tenant
router.get('/', async (req: any, res: any) => {
    try {
        const tenantId = req.tenant.id;
        
        let sql = `SELECT * FROM sales WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100`;
        let params: any[] = [tenantId];
        
        if (req.user?.role === 'vendedor') {
            sql = `SELECT * FROM sales WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 100`;
            params.push(req.user?.id);
        }
        
        const sales = await query(sql, params);
        res.json(sales);
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// GET /api/sales/simulations - Get all simulations history
router.get('/simulations', async (req: any, res: any) => {
    try {
        const tenantId = req.tenant.id;
        
        let sql = `SELECT * FROM simulations WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100`;
        let params: any[] = [tenantId];
        
        if (req.user?.role === 'vendedor') {
            sql = `SELECT * FROM simulations WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 100`;
            params.push(req.user?.id);
        }
        
        const simulations = await query(sql, params);
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
        let remarketingSql = `SELECT s.id, s.client_name as name, s.vehicle_description as car, s.created_at as date, s.status, 
                    s.client_cpf as cpf, COALESCE(c.phone, 'N/A') as phone, COALESCE(c.income, 0) as income, COALESCE(c.email, 'N/A') as email
             FROM simulations s
             LEFT JOIN clients c ON s.client_cpf = c.cpf AND s.tenant_id = c.tenant_id
             WHERE s.tenant_id = ? 
               AND s.status = 'APPROVED' 
               AND s.created_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE)
               AND NOT EXISTS (
                   SELECT 1 FROM sales sa 
                   WHERE sa.tenant_id = s.tenant_id 
                     AND sa.client_cpf = s.client_cpf 
                     AND sa.status = 'FINALIZED'
               )`;
        let remarketingParams: any[] = [tenantId];

        // Retry: Rejected simulations - appear immediately
        let retrySql = `SELECT s.id, s.client_name as name, s.vehicle_description as car, s.created_at as date, 
                    s.client_cpf as cpf, COALESCE(c.phone, 'N/A') as phone, COALESCE(c.income, 0) as income, COALESCE(c.email, 'N/A') as email
             FROM simulations s
             LEFT JOIN clients c ON s.client_cpf = c.cpf AND s.tenant_id = c.tenant_id
             WHERE s.tenant_id = ? AND s.status LIKE 'REJECT%'`;
        let retryParams: any[] = [tenantId];

        if (req.user?.role === 'vendedor') {
            const userId = req.user?.id;
            remarketingSql += ' AND s.user_id = ? ';
            remarketingParams.push(userId);
            retrySql += ' AND s.user_id = ? ';
            retryParams.push(userId);
        }

        remarketingSql += ' ORDER BY s.created_at DESC LIMIT 150';
        retrySql += ' ORDER BY s.created_at DESC LIMIT 150';

        const remarketing = await query(remarketingSql, remarketingParams) as any[];
        const retry = await query(retrySql, retryParams) as any[];

        // Helper to remove duplicate clients (so they don't appear 10 times in a row)
        // Keeps the first instance found, which since we ORDER BY DESC, is the most recent attempt.
        const filterDuplicates = (list: any[]) => {
            const seen = new Set();
            const result = [];
            for (const item of list) {
                const key = item.cpf ? item.cpf.replace(/\D/g, '') : (item.name || '').trim().toLowerCase();
                if (!key) {
                    result.push(item);
                } else if (!seen.has(key)) {
                    seen.add(key);
                    result.push(item);
                }
            }
            return result.slice(0, 50); // limit to 50 unique after filtering
        };

        res.json({ 
            remarketing: filterDuplicates(remarketing), 
            retry: filterDuplicates(retry) 
        });
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
        
        let userIdFilter = '';
        let queryParams: any[] = [tenantId];
        let todayParams: any[] = [tenantId, today];

        if (req.user?.role === 'vendedor') {
            userIdFilter = ' AND user_id = ?';
            const userId = req.user?.id;
            queryParams.push(userId);
            todayParams.push(userId);
        }

        // Basic KPI counts
        const [totalSims] = await query(
            `SELECT COUNT(*) as count FROM simulations WHERE tenant_id = ?${userIdFilter}`,
            queryParams
        ) as any[];

        const [todaySims] = await query(
            `SELECT COUNT(*) as count FROM simulations WHERE tenant_id = ? AND DATE(created_at) = ?${userIdFilter}`,
            todayParams
        ) as any[];

        const [todayApprovals] = await query(
            `SELECT COUNT(*) as count FROM simulations WHERE tenant_id = ? AND DATE(created_at) = ? AND status = 'APPROVED'${userIdFilter}`,
            todayParams
        ) as any[];

        const [totalFinanced] = await query(
            `SELECT COALESCE(SUM(financed_value), 0) as total FROM sales WHERE tenant_id = ? AND status = 'FINALIZED'${userIdFilter}`,
            queryParams
        ) as any[];

        // Monthly Performance (last 6 months sales)
        const monthlyData = await query(
            `SELECT DATE_FORMAT(sale_date, '%b') as name, SUM(financed_value) as value 
             FROM sales 
             WHERE tenant_id = ? AND sale_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)${userIdFilter}
             GROUP BY DATE_FORMAT(sale_date, '%Y-%m'), DATE_FORMAT(sale_date, '%b')
             ORDER BY DATE_FORMAT(sale_date, '%Y-%m')`,
            queryParams
        );

        // Bank Performance via JSON Parsing of result_data
        const simulationsRaw = await query(
            `SELECT bank_name, status, result_data FROM simulations WHERE tenant_id = ?${userIdFilter}`,
            queryParams
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

// POST /api/sales/from-simulation - Create sale linked to a simulation
router.post('/from-simulation', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const userId = req.user?.id;
        const {
            simulationId, bankId, bankName, installments,
            monthlyPayment, interestRate, downPayment,
            financedValue, saleDate
        } = req.body;

        if (!simulationId) {
            return res.status(400).json({ error: 'simulationId é obrigatório' });
        }

        // Fetch the original simulation to get client + vehicle data
        const simRows = await query(
            `SELECT * FROM simulations WHERE id = ? AND tenant_id = ?`,
            [simulationId, tenantId]
        ) as any[];

        if (simRows.length === 0) {
            return res.status(404).json({ error: 'Simulação não encontrada' });
        }

        const sim = simRows[0];
        const id = uuidv4();

        await query(
            `INSERT INTO sales (id, tenant_id, user_id, simulation_id, client_id, client_name, client_cpf, 
             vehicle_id, vehicle_description, bank_id, bank_name, financed_value, down_payment, 
             installments, monthly_payment, interest_rate, status, sale_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FINALIZED', ?)`,
            [
                id, tenantId, userId, simulationId,
                sim.client_id, sim.client_name, sim.client_cpf,
                sim.vehicle_id, sim.vehicle_description,
                bankId, bankName,
                financedValue || 0, downPayment || 0,
                installments || 48, monthlyPayment || 0, interestRate || 0,
                saleDate || new Date()
            ]
        );

        res.status(201).json({ id, message: 'Venda registrada com sucesso!' });
    } catch (error) {
        console.error('Error creating sale from simulation:', error);
        res.status(500).json({ error: 'Failed to create sale from simulation' });
    }
});

// POST /api/sales - Create a new sale (manual)
router.post('/', async (req, res: any) => {
    try {
        const tenantId = req.tenant.id;
        const {
            clientId, clientName, clientCpf, vehicleId, vehicleDescription,
            bankId, bankName, financedValue, downPayment, installments,
            monthlyPayment, interestRate, status, saleDate
        } = req.body;

        const id = uuidv4();
        const userId = req.user?.id;

        await query(
            `INSERT INTO sales (id, tenant_id, user_id, client_id, client_name, client_cpf, vehicle_id, vehicle_description, 
             bank_id, bank_name, financed_value, down_payment, installments, monthly_payment, interest_rate, status, sale_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, tenantId, userId, clientId, clientName, clientCpf, vehicleId, vehicleDescription,
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
        const userId = req.user?.id;

        await query(
            `INSERT INTO simulations (id, tenant_id, user_id, client_id, client_name, client_cpf, vehicle_id, vehicle_description, 
             bank_id, bank_name, status, result_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                tenantId,
                userId,
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
