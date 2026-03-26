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

            // Check for invalid credentials message before waiting for redirect
            try {
                const errorAlert = page.locator('.alert__text:has-text("Usuário ou senha inválido")');
                const hasInvalidCreds = await errorAlert.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
                if (hasInvalidCreds) {
                    console.error('[PanAdapter] ❌ Login failed — Usuário ou senha inválido.');
                    throw new Error('Usuário ou senha inválido.');
                }
            } catch (e: any) {
                if (e.message === 'Usuário ou senha inválido.') throw e;
            }

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
            if (error.message === 'Usuário ou senha inválido.') {
                throw error;
            }
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
            for (const char of cpfClean) {
                await page.keyboard.press(char);
                await page.waitForTimeout(100);
            }
            await page.waitForTimeout(1500);

            // Step 2: Fill phone
            console.log('[PanAdapter] Step 2: Filling phone...');
            const phoneField = page.locator('input[formcontrolname="cellNumber"]');
            await phoneField.waitFor({ state: 'visible', timeout: 10000 });
            await phoneField.click();
            await page.waitForTimeout(500); // Wait for mask and cursor to be fully ready
            await phoneField.fill('');
            const phone = input.client.phone || '';
            const phoneClean = phone.replace(/\D/g, '');
            if (phoneClean) {
                // Slower delay so the mask processes the first digits properly. 
                // We type character by character explicitly to ensure the mask doesn't swallow inputs.
                for (const char of phoneClean) {
                    await page.keyboard.press(char);
                    await page.waitForTimeout(150);
                }
            }
            await page.waitForTimeout(1000);

            // Step 3: Fill plate
            console.log('[PanAdapter] Step 3: Filling plate...');
            const plateField = page.locator('#combo__input[aria-controls="listbox-plate"], input[formcontrolname="licensePlate"]');
            await plateField.first().waitFor({ state: 'visible', timeout: 15000 });
            await page.waitForTimeout(1000); // Extra wait for Angular to enable the field
            await plateField.first().click({ force: true });
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

            console.log('[PanAdapter] Simular clicked! Monitoring for rejection modal for up to 30 seconds...');
            let isRejected = false;
            try {
                // This acts as our 30-second delay. If the modal appears, it resolves early and we abort.
                // If the modal never appears, it throws a TimeoutError after 30s, fulfilling the delay requirement.
                await page.waitForSelector('.pan-mahoe-modal__body:has-text("Proposta recusada"), h1:has-text("Proposta recusada")', { state: 'visible', timeout: 30000 });
                isRejected = true;
            } catch {
                isRejected = false;
            }

            if (isRejected) {
                console.log('[PanAdapter] ❌ Proposta recusada modal detected!');
                return {
                    bankId: this.id,
                    status: 'ERROR',
                    message: 'Proposta recusada. Não conseguimos aprovar o crédito com as condições digitadas.',
                    offers: []
                };
            }

            console.log('[PanAdapter] 30 seconds wait finished (or no rejection found), waiting for results cards...');

            // Step 7.5: Configurar Retorno PAN (R0-R4)
            try {
                // Wait for the first card to ensure we're targeting the most recent simulation
                const firstCard = page.locator('mahoe-card, .card, app-deal-card').first();
                await firstCard.waitFor({ state: 'visible', timeout: 45000 });

                // Strictly locate the button INSIDE the first card. This prevents falling back to older simulations.
                const visualizarBtn = firstCard.locator('button.mahoe-button__ghost:has-text("Visualizar proposta"), button:has-text("Visualizar proposta")').first();
                await visualizarBtn.waitFor({ state: 'visible', timeout: 60000 });
                console.log('[PanAdapter] Clicando em Visualizar proposta para ajustar Retorno...');
                await visualizarBtn.click({ force: true });
                await page.waitForTimeout(2000);

                const panReturn = input.options?.panReturn || '3'; // Default R3
                const returnVal = panReturn.replace('R', '');

                console.log(`[PanAdapter] Ajustando Retorno PAN para R${returnVal}...`);
                const slider = page.locator('input[type="range"][id*="Retorno"]');
                await slider.waitFor({ state: 'visible', timeout: 10000 });

                // Set the value using evaluate to trigger events properly
                await slider.evaluate((node: HTMLInputElement, val) => {
                    node.value = val;
                    node.dispatchEvent(new Event('input', { bubbles: true }));
                    node.dispatchEvent(new Event('change', { bubbles: true }));
                }, returnVal);
                await page.waitForTimeout(1000);

                // Click Recalcular
                console.log('[PanAdapter] Clicando em Recalcular...');
                const recalcularBtn = page.locator('button.mahoe-button__secondary:has-text("Recalcular")').first();
                await recalcularBtn.waitFor({ state: 'visible', timeout: 10000 });
                await recalcularBtn.click({ force: true });

                console.log('[PanAdapter] Aguardando recálculo...');
                await page.waitForTimeout(8000); // Wait for the network to resolve and animation
            } catch (e: any) {
                console.log(`[PanAdapter] Aviso: Não foi possível ajustar o retorno PAN: ${e.message}`);
                // Fallback wait if the button was not found, to ensure the page is fully loaded
                await page.waitForTimeout(10000);
            }

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
                    // Strategy 0: New UI with app-custom-checkbox / installments-container__radio
                    const radioCards = Array.from(document.querySelectorAll('.installments-container__radio, app-custom-checkbox, .custom-radio'));
                    if (radioCards.length > 0) {
                        radioCards.forEach(card => {
                            const text = (card as HTMLElement).innerText?.trim();
                            if (!text) return;

                            const instMatch = text.match(/(\d+)\s*parcelas/i) || text.match(/(\d+)\s*[x×]/i);
                            const valMatch = text.match(/R\$\s*([\d.,]+)/i);

                            const isApproved = text.toLowerCase().includes('aprovado');
                            const isUnavailable = text.toLowerCase().includes('indisponível');

                            if (instMatch && valMatch && (isApproved || isUnavailable)) {
                                const installments = parseInt(instMatch[1]);
                                const paymentStr = valMatch[1].replace(/\./g, '').replace(',', '.');
                                const monthlyPayment = parseFloat(paymentStr);

                                // Extract required minimum downpayment if unavailable
                                let requiredEntry = 0;
                                if (isUnavailable) {
                                    const entryMatch = text.match(/Entrada\s*m[íi]nima\s*de\s*R\$\s*([\d.,]+)/i);
                                    if (entryMatch) {
                                        requiredEntry = parseFloat(entryMatch[1].replace(/\./g, '').replace(',', '.'));
                                    }
                                }

                                results.push({
                                    installments,
                                    monthlyPayment: isUnavailable ? 0 : monthlyPayment,
                                    requiredEntry, // We will map this to the frontend description or a new field
                                    isApproved,
                                    text: text
                                });
                            }
                        });
                        if (results.length > 0) {
                            // The markup has nested spans causing duplicate captures via querySelectorAll
                            // We deduplicate by 'installments' + 'isApproved' combination
                            const uniqueResults = results.filter((value, index, self) =>
                                index === self.findIndex((t) => (
                                    t.installments === value.installments && t.isApproved === value.isApproved
                                ))
                            );
                            return uniqueResults; // If new strategy worked, return immediately
                        }
                    }

                    // Find all cards first (Fallback for older UIs)
                    const cards = Array.from(document.querySelectorAll('mahoe-card, .card'));

                    // We only want the first card (the leftmost/most recent one)
                    const targetCard = cards.length > 0 ? cards[0] : document.body;

                    // Strategy 1: Look for listbox items (from combobox) WITHIN the target card
                    const listboxItems = Array.from(targetCard.querySelectorAll('[id*="listbox-installment"] .combo-option, [role="option"]'));

                    if (listboxItems.length > 0) {
                        listboxItems.forEach(item => {
                            const text = (item as HTMLElement).innerText?.trim();
                            if (!text) return;

                            // Parse patterns like "48x de R$ 3.456,78" ou "48x R$ 3.456,78"
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
                // Pass custom description to show required downpayment for unavailable options
                description: o.isApproved === false && o.requiredEntry > 0 ? `Indisponível - Entrada Mínima: R$ ${o.requiredEntry.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : (o.text || `${o.installments}x`),
                hasHighChance: o.isApproved !== false,
                // We'll mark the specific ones as rejected if they are unavailable 
                status: o.isApproved === false ? 'REJECTED' : 'APPROVED' // Note: 'status' isn't explicitly in SimulationOffer, but frontend map checks for overall simulation result
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
