
import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { tenantMiddleware } from './middleware/tenant';
import { runSimulations } from './rpa/orchestrator';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

import clientRoutes from './routes/clients';
import vehicleRoutes from './routes/vehicles';
import salesRoutes from './routes/sales';
import interactionRoutes from './routes/interactions';

// Apply tenant middleware to API routes
app.use('/api', tenantMiddleware);

// Register Routes
app.use('/api/clients', clientRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/interactions', interactionRoutes);

app.get('/', (req, res) => {
    res.send('FlashCred Server Running (Multi-Tenant)');
});

app.post('/api/simulate', async (req, res) => {
    try {
        const { client, vehicle, banks } = req.body;

        // Log the context
        console.log(`[Tenant: ${req.tenant?.id || 'Unknown'}] Processing simulation request`);

        if (!client || !vehicle) {
            return res.status(400).json({ error: 'Missing client or vehicle data' });
        }

        const selectedBanks = banks || ['c6'];
        const results = await runSimulations(client, vehicle, selectedBanks);

        res.json(results);

    } catch (error: any) {
        console.error('Simulation endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.send('FlashCred Server Running (Multi-Tenant)');
});

// Serve Static Files
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Handle SPA (React) Routes - Send index.html for any request that's not an API call
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
