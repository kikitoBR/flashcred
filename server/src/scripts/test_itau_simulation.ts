import { chromium } from 'playwright';
import { ItauAdapter } from '../rpa/adapters/itau';
import { SimulationInput } from '../rpa/types';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config(); // Also try loading from current working directory

/**
 * Script to test the Itaú simulation flow
 * 
 * Usage:
 *   ITAU_LOGIN='email' ITAU_PASSWORD='pass' npx ts-node src/scripts/test_itau_simulation.ts
 */

(async () => {
    const storageDir = path.join(__dirname, '../../storage/debug');
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    console.log('=== Itaú Simulation Test ===\n');

    // Check credentials
    if (!process.env.ITAU_LOGIN || !process.env.ITAU_PASSWORD) {
        console.error('ERROR: Please set ITAU_LOGIN and ITAU_PASSWORD environment variables');
        process.exit(1);
    }

    // Initialize browser
    console.log('Launching browser...');
    console.log('Launching browser...');
    const browser = await chromium.launch({
        headless: false,
        channel: 'chrome', // Try using system Chrome
        slowMo: 500, // Slow down for debugging
        args: ['--start-maximized']
    });

    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    const adapter = new ItauAdapter();

    try {
        // Step 1: Login
        console.log('\n--- Step 1: Login ---');
        const loginSuccess = await adapter.login(page, {
            login: process.env.ITAU_LOGIN,
            password: process.env.ITAU_PASSWORD
        });

        if (!loginSuccess) {
            console.error('Login failed! Check credentials.');
            await page.screenshot({ path: path.join(storageDir, 'test_login_failed.png') });
            await browser.close();
            process.exit(1);
        }
        console.log('Login successful!');

        // Wait for dashboard to fully load
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(storageDir, 'test_after_login.png') });

        // Step 2: Simulate
        console.log('\n--- Step 2: Simulation ---');

        const simulationInput: SimulationInput = {
            client: {
                cpf: process.env.TEST_CPF || '187.613.547-67', // Use TEST_CPF env var or a known test one
                name: 'Cliente Teste',
                birthDate: '1990-01-01'
            },
            vehicle: {
                plate: 'RIQ9A14',
                brand: 'VOLKSWAGEN',
                model: 'FOX',
                year: 2022,
                price: 55000,
                uf: 'SP'
            },
            downPayment: 15000,
            installments: 48,
            paymentMethod: 'FINANCING'
        };

        console.log('Simulation input:', JSON.stringify(simulationInput, null, 2));

        const result = await adapter.simulate(page, simulationInput);

        console.log('\n--- Simulation Result ---');
        console.log('Status:', result.status);
        console.log('Message:', result.message || 'N/A');
        console.log('Offers:', result.offers.length);

        if (result.offers.length > 0) {
            console.log('\nOffers found:');
            result.offers.forEach((offer, idx) => {
                console.log(`  [${idx + 1}] ${offer.installments}x R$ ${offer.monthlyPayment.toFixed(2)} | Taxa: ${offer.interestRate}% | ${offer.description || ''}`);
            });
        }

        // Save result to JSON
        fs.writeFileSync(
            path.join(storageDir, 'test_simulation_result.json'),
            JSON.stringify(result, null, 2)
        );
        console.log('\nResult saved to test_simulation_result.json');

    } catch (error) {
        console.error('\nTest failed with error:', error);
        await page.screenshot({ path: path.join(storageDir, 'test_error.png') });
    } finally {
        console.log('\nClosing browser...');
        await browser.close();
        console.log('Done.');
    }
})();
