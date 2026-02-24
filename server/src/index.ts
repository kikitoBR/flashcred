
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

import clientRoutes from './routes/clients';
import vehicleRoutes from './routes/vehicles';
import salesRoutes from './routes/sales';
import interactionRoutes from './routes/interactions';
import credentialsRoutes from './routes/credentials';

// Apply tenant middleware to API routes
app.use('/api', tenantMiddleware);

// Register Routes
app.use('/api/clients', clientRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/credentials', credentialsRoutes);

app.get('/', (req, res) => {
    res.send('FlashCred Server Running (Multi-Tenant)');
});

app.post('/api/simulate', async (req, res) => {
    try {
        const { client, vehicle, banks, options } = req.body;

        // Log the context
        console.log(`[Tenant: ${req.tenant?.id || 'Unknown'}] Processing simulation request`);

        if (!client || !vehicle) {
            return res.status(400).json({ error: 'Missing client or vehicle data' });
        }

        const selectedBanks = banks || ['c6'];
        const results = await runSimulations(client, vehicle, selectedBanks, options);

        res.json(results);

    } catch (error: any) {
        console.error('Simulation endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual login endpoint for BV - saves cookies for future automated use
// Just open http://localhost:3001/api/bv/manual-login in your browser!
app.get('/api/bv/manual-login', async (req, res) => {
    console.log('[BV Manual Login] Starting manual login session...');

    try {
        const { chromium } = await import('playwright');
        const fs = await import('fs');
        const path = await import('path');

        const COOKIES_DIR = path.join(__dirname, '../cookies');
        const BV_COOKIES_FILE = path.join(COOKIES_DIR, 'bv_session.json');

        if (!fs.existsSync(COOKIES_DIR)) {
            fs.mkdirSync(COOKIES_DIR, { recursive: true });
        }

        // Use a dedicated user data dir for BV (separate from main Chrome)
        // This creates a "real" browser profile that won't be detected as automation
        const BV_PROFILE_DIR = path.join(COOKIES_DIR, 'bv_chrome_profile');

        if (!fs.existsSync(BV_PROFILE_DIR)) {
            fs.mkdirSync(BV_PROFILE_DIR, { recursive: true });
        }

        console.log('[BV Manual Login] Launching Chrome with persistent profile...');
        console.log(`[BV Manual Login] Profile directory: ${BV_PROFILE_DIR}`);

        // launchPersistentContext creates a real Chrome profile, not detected as automation
        const context = await chromium.launchPersistentContext(BV_PROFILE_DIR, {
            headless: false,
            channel: 'chrome',
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--no-first-run',
                '--no-default-browser-check'
            ],
            viewport: null,
            locale: 'pt-BR',
            timezoneId: 'America/Sao_Paulo',
            ignoreHTTPSErrors: true,
        });

        const page = context.pages()[0] || await context.newPage();

        console.log('[BV Manual Login] Opening BV portal...');
        await page.goto('https://parceiro.bv.com.br/ng-gpar-base-login/', { waitUntil: 'domcontentloaded' });

        console.log('[BV Manual Login] ⏰ Aguardando 2 minutos para login manual...');
        console.log('[BV Manual Login] Por favor, faça login no navegador que abriu:');
        console.log('[BV Manual Login] 1. Preencha usuário e senha');
        console.log('[BV Manual Login] 2. Resolva o CAPTCHA');
        console.log('[BV Manual Login] 3. Clique em ENTRAR');
        console.log('[BV Manual Login] 4. Aguarde o dashboard carregar');

        // Wait 2 minutes for manual login
        await page.waitForTimeout(120000);

        // Check if login was successful
        const currentUrl = page.url();
        console.log(`[BV Manual Login] URL final: ${currentUrl}`);

        if (!currentUrl.toLowerCase().includes('login')) {
            // Save cookies
            await context.storageState({ path: BV_COOKIES_FILE });
            console.log(`[BV Manual Login] ✅ Cookies salvos em: ${BV_COOKIES_FILE}`);
            await context.close();
            res.json({
                success: true,
                message: 'Cookies salvos com sucesso! Próximas simulações usarão esses cookies.',
                cookieFile: BV_COOKIES_FILE
            });
        } else {
            await context.close();
            res.status(400).json({
                success: false,
                message: 'Login não detectado. A URL ainda contém "login". Tente novamente.'
            });
        }

    } catch (error: any) {
        console.error('[BV Manual Login] Erro:', error.message);
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
