import { chromium } from 'playwright';
import { Client, Vehicle, SimulationResult } from '../types';
import { ItauAdapter } from './adapters/itau';
import { BvAdapter } from './adapters/bv';
import { Credential, SimulationInput } from './types';
import * as fs from 'fs';
import * as path from 'path';

// Cookie storage paths
const COOKIES_DIR = path.join(__dirname, '../../cookies');
const BV_COOKIES_FILE = path.join(COOKIES_DIR, 'bv_session.json');
const ITAU_COOKIES_FILE = path.join(COOKIES_DIR, 'itau_session.json');

// Ensure cookies directory exists
if (!fs.existsSync(COOKIES_DIR)) {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
}


export const runSimulations = async (client: any, vehicle: any, banks: string[]) => {
    console.log(`[Orchestrator] Starting simulations for banks: ${banks.join(', ')}`);

    const results: any[] = [];
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome', // Try using system Chrome
        args: ['--start-maximized']
    }); // Headless false for debugging initially

    try {
        for (const bank of banks) {
            if (bank === 'itau' || bank === 'c6' || bank === '3' || bank === '6' || bank === 'bv' || bank === '8') { // RPA Banks: Itau, C6, BV
                console.log(`[Orchestrator] Running simulation for ${bank}...`);

                let context;
                let page;
                let usePersistentContext = false;

                // For BV, use persistent context to avoid bot detection
                if (bank === 'bv' || bank === '8') {
                    const BV_PROFILE_DIR = path.join(COOKIES_DIR, 'bv_chrome_profile');

                    if (!fs.existsSync(BV_PROFILE_DIR)) {
                        fs.mkdirSync(BV_PROFILE_DIR, { recursive: true });
                    }

                    console.log('[Orchestrator] Using persistent Chrome profile for BV...');

                    // Close existing browser if any (we'll use persistent context instead)
                    await browser.close();

                    context = await chromium.launchPersistentContext(BV_PROFILE_DIR, {
                        headless: false,
                        channel: 'chrome',
                        args: [
                            '--start-maximized',
                            '--disable-blink-features=AutomationControlled',
                            '--disable-infobars',
                        ],
                        viewport: null,
                        locale: 'pt-BR',
                        timezoneId: 'America/Sao_Paulo',
                    });

                    page = context.pages()[0] || await context.newPage();
                    usePersistentContext = true;
                } else {
                    // For other banks, use normal context
                    const contextOptions: any = {
                        viewport: null,
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        locale: 'pt-BR',
                        timezoneId: 'America/Sao_Paulo',
                    };

                    context = await browser.newContext(contextOptions);
                    page = await context.newPage();
                }

                // TODO: Retrieve credentials from a secure storage based on tenant
                const credentials: Credential = {
                    login: process.env.ITAU_LOGIN || 'mock_user',
                    password: process.env.ITAU_PASSWORD || 'mock_pass',
                    codAgente: process.env.ITAU_AGENTE || '0000',
                    codOperador: process.env.ITAU_OPERADOR || '0000'
                };

                let adapter;
                let bankCredentials: Credential = credentials;

                if (bank === 'itau' || bank === '3') {
                    adapter = new ItauAdapter();
                } else if (bank === 'bv' || bank === '8') {
                    adapter = new BvAdapter();
                    bankCredentials = {
                        login: process.env.BV_LOGIN || '',
                        password: process.env.BV_PASSWORD || ''
                    };
                } else {
                    console.warn(`[Orchestrator] No adapter found for ${bank}, skipping RPA for this bank.`);
                    continue;
                }

                const loggedIn = await adapter.login(page, bankCredentials);

                // Log success
                if (loggedIn) {
                    console.log(`[Orchestrator] Login successful for ${bank}`);
                }

                if (loggedIn) {
                    const input: SimulationInput = {
                        client: {
                            cpf: client.cpf,
                            name: client.name,
                            birthDate: client.birthDate || '01/01/1980', // Default if missing
                        },
                        vehicle: {
                            plate: vehicle.plate,
                            brand: vehicle.brand,
                            model: vehicle.model,
                            year: vehicle.year,
                            price: vehicle.price,
                            uf: 'SP' // Default UF
                        },
                        downPayment: vehicle.downPayment || vehicle.entryValue || 0
                    };

                    const simulationResult = await adapter.simulate(page, input);

                    // Map RPA result to App format if successful
                    if (simulationResult.status === 'SUCCESS') {
                        results.push({
                            bankId: bank,
                            status: 'APPROVED', // Assuming success means approved for now
                            interestRate: simulationResult.offers.find(o => o.interestRate > 0)?.interestRate || 0,
                            maxInstallments: 60,
                            downPayment: input.downPayment,
                            installments: simulationResult.offers.map(o => ({
                                months: o.installments,
                                value: o.monthlyPayment,
                                interestRate: o.interestRate,
                                hasHighChance: o.hasHighChance
                            })),
                            reason: simulationResult.message
                        });
                    } else {
                        results.push({
                            bankId: bank,
                            status: 'REJECTED',
                            reason: simulationResult.message || 'Simulation failed'
                        });
                    }
                } else {
                    console.error(`[Orchestrator] Failed to login to ${bank}`);
                    results.push({
                        bankId: bank,
                        status: 'ERROR',
                        reason: 'Login failed'
                    });
                }

                await context.close();
            } else {
                // Mock result for other banks
                results.push({
                    bankId: bank,
                    status: 'ANALYSIS',
                    interestRate: 1.99,
                    installments: [
                        { months: 48, value: 1500 }
                    ]
                });
            }
        }
    } catch (error) {
        console.error('[Orchestrator] Global error:', error);
    } finally {
        await browser.close();
    }

    return {
        id: new Date().getTime().toString(),
        date: new Date().toISOString(),
        client,
        vehicle,
        offers: results
    };
};
