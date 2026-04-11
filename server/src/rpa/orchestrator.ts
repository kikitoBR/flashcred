import { chromium } from 'playwright';
import { Client, Vehicle, SimulationResult } from '../types';
import { ItauAdapter } from './adapters/itau';
import { OmniAdapter } from './adapters/omni';
import { SafraAdapter } from './adapters/safra';
import { PanAdapter } from './adapters/pan';
import { C6Adapter } from './adapters/c6';
import { BradescoAdapter } from './adapters/bradesco';
import { Credential, SimulationInput, BankAdapter } from './types';
import { credentialService } from './credential-service';
import * as fs from 'fs';
import * as path from 'path';

// Cookie storage paths
const COOKIES_DIR = path.join(__dirname, '../../cookies');

// Ensure cookies directory exists
if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
}

// Bank ID mapping (numeric IDs from frontend → internal adapter IDs)
const BANK_ID_MAP: Record<string, string> = {
    '1': 'itau',
    '2': 'bradesco',
    '4': 'bv',
    '5': 'pan',
    '6': 'c6',
    '7': 'safra',
    '9': 'omni',
    'itau': 'itau',
    'bradesco': 'bradesco',
    'omni': 'omni',
    'safra': 'safra',
    'pan': 'pan',
};

// RPA-supported bank IDs
const RPA_BANK_IDS = new Set(Object.keys(BANK_ID_MAP));

// Adapter factory
function createAdapter(bankId: string): BankAdapter | null {
    switch (bankId) {
        case 'itau': return new ItauAdapter();
        case 'omni': return new OmniAdapter();
        case 'safra': return new SafraAdapter();
        case 'pan': return new PanAdapter();
        case 'c6': return new C6Adapter();
        case 'bradesco': return new BradescoAdapter();
        default: return null;
    }
}

export const runSimulations = async (client: any, vehicle: any, banks: string[], options?: any) => {
    console.log(`[Orchestrator] Starting PARALLEL simulations for banks: ${banks.join(', ')}`);

    // Separate RPA banks from mock banks
    const rpaBanks = banks.filter(b => RPA_BANK_IDS.has(b));
    const mockBanks = banks.filter(b => !RPA_BANK_IDS.has(b));

    // Mock results (instant)
    const mockResults = mockBanks.map(bank => ({
        bankId: bank,
        status: 'ANALYSIS',
        interestRate: 1.99,
        installments: [{ months: 48, value: 1500 }]
    }));

    // Build shared simulation input
    const input: SimulationInput = {
        client: {
            cpf: client.cpf,
            name: client.name,
            birthDate: client.birthDate || '01/01/1980',
            phone: client.phone,
            email: client.email,
            zipCode: client.address?.zipCode || client.zipCode || client.cep, // Map ZIP code from DB/Frontend
        },
        vehicle: {
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            price: vehicle.price,
            uf: vehicle.uf || 'SP',
            condition: vehicle.condition || 'SEMINOVO'
        },
        downPayment: vehicle.downPayment || vehicle.entryValue || 0,
        options: options
    };

    // Launch ONE browser, then run all RPA banks in PARALLEL contexts
    let browser;
    let rpaResults: any[] = [];

    const isHeadless = process.env.RPA_HEADLESS === 'true';

    if (rpaBanks.length > 0) {
        browser = await chromium.launch({
            headless: isHeadless,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--js-flags="--max-old-space-size=512"' // Limit memory per tab
            ]
        });
        try {
            // Create parallel promises for each RPA bank with a small stagger
            const rpaPromises = rpaBanks.map(async (bank, index) => {
                // Wait a small amount (2s per bank) to stagger the CPU load spike
                if (index > 0) {
                    await new Promise(resolve => setTimeout(resolve, index * 2000));
                }

                const internalBankId = BANK_ID_MAP[bank];
                console.log(`[Orchestrator] 🚀 Launching parallel simulation for ${internalBankId} (${bank})`);

                const adapter = createAdapter(internalBankId);
                if (!adapter) {
                    console.warn(`[Orchestrator] No adapter for ${internalBankId}`);
                    return { bankId: bank, status: 'ERROR', reason: 'Integração não disponível para este banco.' };
                }

                const tenantId = 'tenant-123';
                const userId = input.options?.userId;
                
                if (!userId) {
                    console.error(`[Orchestrator] Falha: userId é obrigatório. Banco: ${bank}`);
                    return { bankId: bank, status: 'REJECTED', reason: 'Usuário não autenticado ou faltando ID.' };
                }

                const credentials = await credentialService.getCredentials(bank, tenantId, userId);
                if (!credentials) {
                    console.error(`[Orchestrator] No credentials for ${bank}`);
                    return { bankId: bank, status: 'ERROR', reason: 'Credencial não definida: Por favor, configure os dados de acesso no painel de credenciais.' };
                }

                const context = await browser!.newContext({
                    viewport: { width: 1366, height: 768 },
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    locale: 'pt-BR',
                    timezoneId: 'America/Sao_Paulo',
                    permissions: ['geolocation'],
                });
                const page = await context.newPage();

                // PERFORMANCE OPTIMIZATION (Phase 1): Block images, media, and fonts to save CPU/RAM/Bandwidth
                await page.route('**/*', (route) => {
                    const type = route.request().resourceType();
                    if (['image', 'media', 'font'].includes(type)) {
                        route.abort();
                    } else {
                        route.continue();
                    }
                });

                // Anti-bot detection for ALL banks (centralized)
                await page.addInitScript(() => {
                    // Hide webdriver flag
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    // Fake Chrome runtime
                    (window as any).chrome = { runtime: {} };
                    // Override permissions API
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters: any) =>
                        parameters.name === 'notifications'
                            ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
                            : originalQuery(parameters);
                });

                // Set generous timeouts for VPS parallel execution
                page.setDefaultTimeout(60000);
                page.setDefaultNavigationTimeout(90000);

                try {
                    console.log(`[Orchestrator] 🔑 Attempting login for ${internalBankId}...`);
                    const loggedIn = await adapter.login(page, credentials);
                    if (!loggedIn) {
                        const currentUrl = page.url();
                        console.error(`[Orchestrator] ❌ Login failed for ${internalBankId}. URL: ${currentUrl}`);
                        return { bankId: bank, status: 'LOGIN_FAILED', reason: 'Falha geral ao conectar no sistema do banco.' };
                    }

                    console.log(`[Orchestrator] ✅ Login OK for ${internalBankId}`);

                    const simulationResult = await adapter.simulate(page, input);

                    if (simulationResult.status === 'SUCCESS') {
                        return {
                            bankId: bank,
                            status: 'APPROVED',
                            interestRate: simulationResult.offers.find((o: any) => o.interestRate > 0)?.interestRate || 0,
                            maxInstallments: 60,
                            downPayment: input.downPayment,
                            minDownPayment: simulationResult.minDownPayment,
                            installments: simulationResult.offers.map((o: any) => ({
                                months: o.installments,
                                value: o.monthlyPayment,
                                interestRate: o.interestRate,
                                hasHighChance: o.hasHighChance,
                                description: o.description
                            })),
                            reason: simulationResult.message,
                            warning: simulationResult.warning,
                            minimumDownPayment: simulationResult.minimumDownPayment
                        };
                    } else {
                        return {
                            bankId: bank,
                            status: 'REJECTED',
                            reason: simulationResult.message || 'Proposta não aprovada na política do banco.'
                        };
                    }
                } catch (error: any) {
                    console.error(`[Orchestrator] Error for ${internalBankId}:`, error.message);
                    if (
                        error.message === 'Usuário ou senha inválida' || 
                        error.message === 'Usuário e/ou senha inválido(s)' || 
                        error.message === 'Nome de usuário ou senha inválida' ||
                        error.message === 'CPF inválido ou senha incorreta' ||
                        error.message === 'Usuário ou senha inválido.'
                    ) {
                        return { bankId: bank, status: 'REJECTED', reason: 'Usuário e/ou senha inválido(s)' };
                    }
                    return { bankId: bank, status: 'ERROR', reason: error.message || 'Erro inesperado na comunicação com o banco.' };
                } finally {
                    await context.close();
                }
            });

            // Run ALL RPA simulations in parallel!
            console.log(`[Orchestrator] ⚡ Running ${rpaBanks.length} RPA simulations in parallel (Phase 1 Optimization)...`);
            rpaResults = await Promise.all(rpaPromises);
            console.log(`[Orchestrator] ✅ All ${rpaBanks.length} parallel simulations completed!`);

        } catch (error) {
            console.error('[Orchestrator] Global error:', error);
        } finally {
            await browser.close();
        }
    }

    return {
        id: new Date().getTime().toString(),
        date: new Date().toISOString(),
        client,
        vehicle,
        offers: [...mockResults, ...rpaResults]
    };
};
