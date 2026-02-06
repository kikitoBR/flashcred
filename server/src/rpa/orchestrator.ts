import { chromium } from 'playwright';
import { Client, Vehicle, SimulationResult } from '../types';
import { ItauAdapter } from './adapters/itau';
import { Credential, SimulationInput } from './types';


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
            if (bank === 'itau' || bank === 'c6' || bank === '3' || bank === '6') { // Generic check, currently only Itau implemented
                console.log(`[Orchestrator] Running simulation for ${bank}...`);
                const context = await browser.newContext({ viewport: null });
                const page = await context.newPage();

                // TODO: Retrieve credentials from a secure storage based on tenant
                const credentials: Credential = {
                    login: process.env.ITAU_LOGIN || 'mock_user',
                    password: process.env.ITAU_PASSWORD || 'mock_pass',
                    codAgente: process.env.ITAU_AGENTE || '0000',
                    codOperador: process.env.ITAU_OPERADOR || '0000'
                };

                let adapter;
                if (bank === 'itau' || bank === '3') {
                    adapter = new ItauAdapter();
                } else {
                    console.warn(`[Orchestrator] No adapter found for ${bank}, skipping RPA for this bank.`);
                    continue;
                }
                const loggedIn = await adapter.login(page, credentials);

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
                            interestRate: 2.5, // Mock data until scraper is real
                            maxInstallments: 48,
                            downPayment: vehicle.price * 0.3,
                            installments: simulationResult.offers.map(o => ({
                                months: o.installments,
                                value: o.monthlyPayment
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
