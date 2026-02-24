import { Page } from 'playwright';
import { BankAdapter, Credential, SimulationInput, SimulationResult, SimulationOffer } from '../../types';

export class PanAdapter implements BankAdapter {
    id = 'pan';
    name = 'Banco Pan';
    private baseUrl = 'https://veiculos.bancopan.com.br/login';

    // =============================
    // LOGIN
    // =============================
    async login(page: Page, credentials: Credential): Promise<boolean> {
        console.log(`[PanAdapter] Logging in as ${credentials.login}...`);
        try {
            await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(3000);

            // Check if already logged in
            if (page.url().includes('/captura/inicio')) {
                console.log('[PanAdapter] ✅ Session already active!');
                return true;
            }

            // Fill login
            const loginField = page.locator('#login');
            await loginField.waitFor({ state: 'visible', timeout: 15000 });
            await loginField.click();
            await loginField.fill('');
            await page.keyboard.type(credentials.login, { delay: 30 });

            // Fill password
            const passwordField = page.locator('#password');
            await passwordField.waitFor({ state: 'visible', timeout: 5000 });
            await passwordField.click();
            await passwordField.fill('');
            await page.keyboard.type(credentials.password || '', { delay: 30 });

            await page.waitForTimeout(1000);

            // Click "Entrar" button — only clickable after credentials are filled
            const entrarBtn = page.locator('.pan-mahoe-button__wrapper').first();
            await entrarBtn.waitFor({ state: 'visible', timeout: 10000 });
            await entrarBtn.click();

            // Wait for redirect to /captura/inicio
            try {
                await page.waitForURL(url => url.toString().includes('/captura/inicio'), { timeout: 30000 });
                console.log(`[PanAdapter] ✅ Login OK → ${page.url()}`);
                return true;
            } catch {
                if (page.url().includes('/captura/inicio')) return true;
                console.error('[PanAdapter] ❌ Login failed — did not redirect to /captura/inicio');
                return false;
            }
        } catch (error: any) {
            console.error('[PanAdapter] Login exception:', error.message);
            return false;
        }
    }

    // =============================
    // SIMULATE
    // =============================
    async simulate(page: Page, input: SimulationInput): Promise<SimulationResult> {
        console.log(`[PanAdapter] Starting simulation for CPF: ${input.client.cpf}...`);
        const result: SimulationResult = { bankId: this.id, status: 'ERROR', offers: [] };

        try {
            // Ensure we are on the correct page
            if (!page.url().includes('/captura/inicio')) {
                await page.goto('https://veiculos.bancopan.com.br/captura/inicio', { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(3000);
            }

            // Step 1: Fill CPF
            console.log('[PanAdapter] Step 1: Filling CPF...');
            const cpfField = page.locator('#combo__input[aria-controls="listbox-cpf"]');
            await cpfField.waitFor({ state: 'visible', timeout: 15000 });
            await cpfField.click();
            await cpfField.fill('');
            const cpfClean = input.client.cpf.replace(/\D/g, '');
            await page.keyboard.type(cpfClean, { delay: 50 });
            await page.waitForTimeout(1500);

            // Step 2: Fill phone
            console.log('[PanAdapter] Step 2: Filling phone...');
            const phoneField = page.locator('input[formcontrolname="cellNumber"]');
            await phoneField.waitFor({ state: 'visible', timeout: 10000 });
            await phoneField.click();
            await page.waitForTimeout(300); // Wait for mask and cursor to be fully ready
            await phoneField.fill('');
            const phone = input.client.phone || '';
            const phoneClean = phone.replace(/\D/g, '');
            if (phoneClean) {
                // Slower delay so the mask processes the first digits properly
                await page.keyboard.type(phoneClean, { delay: 200 });
            }
            await page.waitForTimeout(1000);

            // Step 3: Fill plate
            console.log('[PanAdapter] Step 3: Filling plate...');
            const plateField = page.locator('#combo__input[aria-controls="listbox-plate"]');
            await plateField.waitFor({ state: 'visible', timeout: 10000 });
            await plateField.click();
            await plateField.fill('');
            await page.keyboard.type(input.vehicle.plate.replace(/[-\s]/g, '').toUpperCase(), { delay: 80 });
            await page.waitForTimeout(2000);

            // Step 4: Fill sale value (valor de venda)
            console.log('[PanAdapter] Step 4: Filling sale value...');
            const valueField = page.locator('input[inputid="value"]');
            await valueField.waitFor({ state: 'visible', timeout: 10000 });
            await valueField.click();
            await valueField.fill('');
            // Removendo o multiplicador de centavos, pois a máscara do PAN aceita o valor inteiro.
            await page.keyboard.type(String(Math.round(input.vehicle.price)), { delay: 50 });
            await page.keyboard.press('Tab');
            await page.waitForTimeout(1000);

            // Step 5: Fill down payment (valor de entrada)
            console.log('[PanAdapter] Step 5: Filling down payment...');
            const entryField = page.locator('input[inputid="requestedEntry"]');
            await entryField.waitFor({ state: 'visible', timeout: 10000 });
            await entryField.click();
            await entryField.fill('');
            const downPayment = input.downPayment || 0;
            await page.keyboard.type(String(Math.round(downPayment)), { delay: 50 });
            await page.keyboard.press('Tab');
            await page.waitForTimeout(1000);

            // Step 6: Select UF (licenciamento)
            const uf = input.vehicle.uf || 'SP';
            console.log(`[PanAdapter] Step 6: Selecting UF: ${uf}`);
            const ufField = page.locator('input[label="UF licenciamento"]');
            await ufField.waitFor({ state: 'visible', timeout: 10000 });
            await ufField.click();
            await page.waitForTimeout(500);

            // Clear and type the UF
            await ufField.fill('');
            await page.keyboard.type(uf, { delay: 150 });
            await page.waitForTimeout(1000);

            // Select from the dropdown using Keyboard to be safe on Angular Material/Mahoe components
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(300);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);

            // Step 7: Click "Simular"
            console.log('[PanAdapter] Step 7: Clicking Simular...');
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(500);

            const simularBtn = page.locator('mahoe-button[variant="primary"] button, button:has-text("Simular")').first();
            await simularBtn.waitFor({ state: 'visible', timeout: 10000 });
            await simularBtn.click({ force: true });
            console.log('[PanAdapter] Simular clicked! Waiting for results...');
            await page.waitForTimeout(60000);

            // Step 8: Extract results
            console.log('[PanAdapter] Step 8: Extracting results...');

            // Open combobox to reveal all installment options
            const installmentCombo = page.locator('#combo__input[aria-controls="listbox-installment"]');
            try {
                await installmentCombo.waitFor({ state: 'visible', timeout: 15000 });
                await installmentCombo.click();
                await page.waitForTimeout(2000);
            } catch {
                console.log('[PanAdapter] Installment combobox not found, trying to scrape visible results...');
            }

            // Scrape all visible installment options from the MOST RECENT (leftmost) card
            const offersData = await page.evaluate(() => {
                const results: any[] = [];

                try {
                    // Find all cards first
                    const cards = Array.from(document.querySelectorAll('mahoe-card, .card'));

                    // We only want the first card (the leftmost/most recent one)
                    const targetCard = cards.length > 0 ? cards[0] : document.body;

                    // Strategy 1: Look for listbox items (from combobox) WITHIN the target card
                    const listboxItems = Array.from(targetCard.querySelectorAll('[id*="listbox-installment"] .combo-option, [role="option"]'));

                    if (listboxItems.length > 0) {
                        listboxItems.forEach(item => {
                            const text = (item as HTMLElement).innerText?.trim();
                            if (!text) return;

                            // Parse patterns like "48x de R$ 3.456,78" or "48x R$ 3.456,78"
                            const match = text.match(/(\d+)\s*[x×]\s*(?:de\s*)?R\$\s*([\d.,]+)/i);
                            if (match) {
                                results.push({
                                    installments: parseInt(match[1]),
                                    monthlyPayment: parseFloat(match[2].replace(/\./g, '').replace(',', '.')),
                                    text: text
                                });
                            }
                        });
                    } else {
                        // Strategy 2: Cards / divs with offer data WITHIN the target card
                        const allElements = Array.from(targetCard.querySelectorAll('div, span, label, li, p'));
                        allElements.forEach(el => {
                            const text = (el as HTMLElement).innerText?.trim();
                            if (!text || text.length > 150) return;

                            const match = text.match(/(\d+)\s*[x×]\s*(?:de\s*)?R\$\s*([\d.,]+)/i);
                            if (match) {
                                const rateMatch = text.match(/([\d.,]+)\s*%\s*(?:ao\s*mês|a\.m\.)/i);
                                results.push({
                                    installments: parseInt(match[1]),
                                    monthlyPayment: parseFloat(match[2].replace(/\./g, '').replace(',', '.')),
                                    interestRate: rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) : 0,
                                    text: text
                                });
                            }
                        });
                    }
                } catch (e) {
                    // Safe error handling
                }

                // Deduplicate by installments
                const unique = new Map<number, any>();
                results.forEach(r => {
                    if (!unique.has(r.installments) || (r.interestRate && r.interestRate > 0)) {
                        unique.set(r.installments, r);
                    }
                });

                return Array.from(unique.values()).sort((a: any, b: any) => a.installments - b.installments);
            });

            console.log(`[PanAdapter] Extracted ${offersData.length} offers.`);
            console.log('[PanAdapter] Offers:', offersData);

            result.offers = offersData.map((o: any) => ({
                bankId: 'pan',
                installments: o.installments,
                monthlyPayment: o.monthlyPayment,
                totalValue: o.installments * o.monthlyPayment,
                interestRate: o.interestRate || 0,
                description: o.text || `${o.installments}x`,
            })) as SimulationOffer[];

            if (result.offers.length > 0) {
                result.status = 'SUCCESS';
                console.log(`[PanAdapter] ✅ Found ${result.offers.length} offers!`);
            } else {
                console.log('[PanAdapter] ⚠️ No offers extracted. Check selectors or page state.');
                result.message = 'No offers found on page';
            }

        } catch (error: any) {
            console.error('[PanAdapter] Simulation failed:', error.message);
            result.message = error.message;
        }

        return result;
    }
}
