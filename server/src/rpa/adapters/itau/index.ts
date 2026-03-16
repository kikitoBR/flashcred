import { Page } from 'playwright';
import { BankAdapter, Credential, SimulationInput, SimulationResult, SimulationOffer } from '../../types';

export class ItauAdapter implements BankAdapter {
    id = 'itau';
    name = 'Itaú Credline';
    private baseUrl = 'https://www.credlineitau.com.br';

    async login(page: Page, credentials: Credential): Promise<boolean> {
        console.log(`[ItauAdapter] Logging in as ${credentials.login}...`);
        try {
            await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
            const frameElement = await page.waitForSelector('iframe[src*="accounts-vehicle.itau.com.br"]', { timeout: 30000 });
            const frame = await frameElement.contentFrame();
            if (!frame) return false;
            await frame.waitForSelector('#username', { timeout: 15000 });
            await frame.fill('#username', credentials.login);
            await frame.fill('#password', credentials.password || '');
            await frame.click('#kc-login');
            await page.waitForLoadState('networkidle');

            // Handle "É hora de aproveitar!" popup - Aggressive JS approach
            try {
                console.log('[ItauAdapter] Checking for popup (Login phase) with JS...');
                await page.waitForTimeout(2000); // Wait for animation

                const closed = await page.evaluate(() => {
                    const selectors = [
                        '.dialog-header-close',
                        '.dialog-header-btn',
                        'button[aria-label="Fechar"]',
                        'mat-dialog-container button',
                        'publication-popup-dialog button'
                    ];

                    for (const s of selectors) {
                        const el = document.querySelector(s) as HTMLElement;
                        if (el) {
                            el.click();
                            return `Clicked ${s}`;
                        }
                    }
                    return null;
                });

                if (closed) {
                    console.log(`[ItauAdapter] Popup closed via JS: ${closed}`);
                    await page.waitForTimeout(1000);
                } else {
                    console.log('[ItauAdapter] No popup found via JS selectors');
                }
            } catch (e) {
                console.log('[ItauAdapter] Error handling popup:', e);
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    async simulate(page: Page, input: SimulationInput): Promise<SimulationResult> {
        console.log(`[ItauAdapter] Starting simulation for CPF: ${input.client.cpf}...`);
        const result: SimulationResult = { bankId: this.id, status: 'ERROR', offers: [] };

        try {
            // Check for popup again before starting simulation flow
            try {
                console.log('[ItauAdapter] Checking for popup (Simulate phase)...');
                const popupSelectors = [
                    'button.dialog-header-close',
                    'button.dialog-header-btn',
                    'mat-dialog-container button',
                    'publication-popup-dialog button'
                ];

                for (const selector of popupSelectors) {
                    try {
                        const closeBtn = page.locator(selector).first();
                        if (await closeBtn.isVisible({ timeout: 2000 })) {
                            console.log(`[ItauAdapter] Closing popup before simulation using selector: ${selector}`);
                            await closeBtn.click();
                            await page.waitForTimeout(1000);
                            break;
                        }
                    } catch { /* optimize loop */ }
                }
            } catch (e) { /* ignore */ }

            // Step 1: Nav
            await page.locator('.sidenav').first().hover();
            await page.waitForTimeout(500);
            await page.locator('button:has-text("Simulador PF")').first().click();
            await page.waitForTimeout(3000);

            // Step 2: CPF
            const cpfField = await page.locator('input[formcontrolname="clientDocument"], .ids-input input').first();
            await cpfField.click({ force: true });
            await page.keyboard.press('Control+A');
            await page.keyboard.press('Backspace');
            await page.keyboard.type(input.client.cpf.replace(/\D/g, ''), { delay: 50 });
            await page.waitForTimeout(1000);

            await page.evaluate(() => window.scrollBy(0, 300));
            await page.locator('button:has-text("Continuar")').first().click({ force: true });
            await page.waitForTimeout(4000);

            // Step 3: Vehicle Data
            // await page.locator('label:has-text("Usado")').first().click({ force: true });
            // await page.waitForTimeout(1500);

            // PLACA TAB
            const placaTab = await page.locator('.ids-tab:has-text("Placa"), [role="tab"]:has-text("Placa")').first();
            await placaTab.click({ force: true });
            await page.waitForTimeout(3000);

            // FILL PLACA
            if (input.vehicle.plate) {
                console.log(`[ItauAdapter] Typing plate: ${input.vehicle.plate}`);
                const helpText = await page.locator('text=Digite apenas letras e números').first();
                if (await helpText.isVisible()) {
                    const box = await helpText.boundingBox();
                    if (box) {
                        await page.mouse.click(box.x + box.width / 2, box.y - 15);
                        await page.waitForTimeout(500);
                        await page.keyboard.press('Control+A');
                        await page.keyboard.press('Backspace');
                        await page.keyboard.type(input.vehicle.plate.toUpperCase(), { delay: 100 });
                        await page.waitForTimeout(1000);
                    }
                }

                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(500);

                const buscarBtn = await page.locator('button:has-text("Buscar veículo")').first();
                if (await buscarBtn.isEnabled()) {
                    await buscarBtn.click({ force: true });
                    console.log('[ItauAdapter] Lookup started...');
                    await page.waitForTimeout(8000);

                    // SELECT VEHICLE
                    const vehicleRadio = await page.locator('input[type="radio"] + label, .ids-radio-button, [role="radio"]').first();
                    if (await vehicleRadio.isVisible()) {
                        await vehicleRadio.click({ force: true });
                        await page.waitForTimeout(2000);
                    }
                }
            }

            // VALUE
            const valField = await page.locator('input[formcontrolname*="value"], [data-cy="vehicle-value"]').first();
            if (await valField.isVisible()) {
                const currentVal = await valField.inputValue();
                if (!currentVal || currentVal.includes('0,00')) {
                    await valField.click({ force: true, clickCount: 3 });
                    await page.keyboard.type(String(input.vehicle.price * 100), { delay: 50 });
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(2000);
                }
            }

            // FINAL CLICK
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
            const simBtn = await page.locator('button:has-text("Simular financiamento")').first();
            await simBtn.click({ force: true });
            await page.waitForTimeout(10000);

            // SCROLL DOWN TO REVEAL RESULTS/ENTRY
            console.log('[ItauAdapter] Scrolling down to reveal results...');
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);

            // HANDLE DOWN PAYMENT (ENTRADA)
            if (input.downPayment && input.downPayment > 0) {
                console.log('[ItauAdapter] Handling down payment field...');

                try {
                    // Strategy: Find label "Valor de entrada" and get the input immediately following it within the same container context usually
                    const entryInput = await page.locator('text="Valor de entrada" >> xpath=following::input[1]').first();

                    if (await entryInput.isVisible()) {
                        console.log(`[ItauAdapter] Found entry field. Clearing pre-filled value...`);

                        await entryInput.scrollIntoViewIfNeeded();
                        await page.waitForTimeout(500);

                        // Aggressive clear: Click, Click x3, Backspace, Ctrl+A, Backspace
                        await entryInput.click({ force: true });
                        await page.waitForTimeout(200);
                        await entryInput.click({ clickCount: 3 });
                        await page.waitForTimeout(100);
                        await page.keyboard.press('Backspace');
                        await page.waitForTimeout(100);
                        await page.keyboard.press('Control+A');
                        await page.keyboard.press('Backspace');

                        console.log(`[ItauAdapter] Typing new value (in cents): ${Math.round(input.downPayment * 100)}`);
                        await page.keyboard.type(Math.round(input.downPayment * 100).toString(), { delay: 100 });
                        await page.waitForTimeout(500);
                        await page.keyboard.press('Tab');

                        console.log('[ItauAdapter] Value entered. Waiting for recalculation...');
                        await page.waitForTimeout(4000);

                        // Click Recalcular if present
                        const recalcBtn = await page.locator('button:has-text("Recalcular"), button:has-text("Atualizar")').first();
                        if (await recalcBtn.isVisible()) {
                            await recalcBtn.click();
                            await page.waitForTimeout(5000);
                        }
                    } else {
                        console.error('[ItauAdapter] ERROR: "Valor de entrada" input not found using visual proximity selector.');
                    }
                } catch (err) {
                    console.error('[ItauAdapter] Exception handling down payment:', err);
                }
            }

            // ── HANDLE LOJISTA RETURN (RE) ──
            try {
                const itauReturnVal = String((input as any).options?.itauReturn || '0');
                console.log(`[ItauAdapter] Configuring Return setting to: ${itauReturnVal}`);

                // 1. Click the gear icon to open modal
                const gearBtn = page.locator('button[data-cy="open-return-modal"], button[aria-label="Alterar R"]').first();
                if (await gearBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                    await gearBtn.click();
                    await page.waitForTimeout(2000); // wait for modal animation

                    // 2. Click the select dropdown (Strict locator to avoid background elements like "Ocupação")
                    const selectCombo = page.locator('ids-select[formcontrolname="returnValue"] [role="combobox"], label:has-text("Valor do retorno") >> xpath=..//div[@role="combobox"]').first();
                    if (await selectCombo.isVisible()) {
                        await selectCombo.click({ force: true });
                        await page.waitForTimeout(1000); // wait for options overlay

                        // 3. Pick the option corresponding to the Return value (0 to 5, etc)
                        // This is an Angular component <ids-select>. It opens a cdk-overlay container.
                        console.log('[ItauAdapter] Focusing dropdown and using keyboard navigation...');
                        
                        try {
                            // Ensure focus on the combobox
                            await selectCombo.focus();
                            // Press Home to jump to the first option (R0)
                            await page.keyboard.press('Home');
                            await page.waitForTimeout(300);
                            
                            // Press ArrowDown the exact amount of times to reach the desired return (e.g. 4 times for R4)
                            const targetIndex = parseInt(itauReturnVal);
                            for (let i = 0; i < targetIndex; i++) {
                                await page.keyboard.press('ArrowDown');
                                await page.waitForTimeout(150);
                            }
                            
                            // Press Enter to confirm selection
                            await page.keyboard.press('Enter');
                            await page.waitForTimeout(500);
                            
                            // Verify if the value visually updated, if not, try JS injection
                            const currentText = await selectCombo.innerText();
                            if (!currentText.includes(itauReturnVal)) {
                                console.log('[ItauAdapter] Keyboard nav seemed to fail. Attempting JS Injection fallback.');
                                await page.evaluate((val) => {
                                    const selectEl = document.querySelector('ids-select[formcontrolname="returnValue"]');
                                    if (selectEl) {
                                        // Attempt to manually trigger Angular bindings
                                        (selectEl as any).value = val;
                                        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                                        selectEl.dispatchEvent(new Event('input', { bubbles: true }));
                                        selectEl.dispatchEvent(new Event('ngModelChange', { bubbles: true }));
                                    }
                                }, itauReturnVal);
                                await page.waitForTimeout(1000);
                            }
                        } catch (err) {
                            console.log('[ItauAdapter] Error during selection:', err);
                        }

                        // 4. Submit
                        const applyBtn = page.locator('button[data-cy="apply-return-button"], button:has-text("Alterar retorno")').first();
                        await applyBtn.click({ force: true });
                        console.log('[ItauAdapter] Return updated. Waiting 8s for recalculation...');
                        
                        await page.waitForTimeout(8000); 

                        // Also look for any 'Recalcular' button just in case changing the value triggers the need to click it
                        const recalcBtnAgain = await page.locator('button:has-text("Recalcular"), button:has-text("Atualizar")').first();
                        if (await recalcBtnAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
                            await recalcBtnAgain.click();
                            await page.waitForTimeout(5000);
                        }
                    } else {
                        console.log('[ItauAdapter] ⚠️ Return dropdown not found inside modal.');
                    }
                } else {
                    console.log('[ItauAdapter] ℹ️ Gear icon "Alterar R" not found on screen. Skipping config.');
                }
            } catch (e: any) {
                console.error('[ItauAdapter] ⚠️ Error configuring Lojista Return:', e.message);
            }

            // SCRAPE OFFERS
            console.log('[ItauAdapter] Scraping offers (v3 - Broad)...');

            // Wait for whatever container holds results
            await page.waitForTimeout(2000);

            const pageContent = await page.content();
            // Optional: Save page content for debug if in dev mode
            // fs.writeFileSync('debug_offers_page.html', pageContent);

            const offersData = await page.evaluate(() => {
                const results: any[] = [];

                try {
                    // Strategy 1: Specific Cards
                    const cards = Array.from(document.querySelectorAll('.ids-card, .offer-card, app-simulation-card, .card-offer, label.ids-radio-button, div[class*="card"]'));

                    cards.forEach(card => {
                        const text = (card as HTMLElement).innerText;
                        if (!text) return;

                        const mainMatch = text.match(/(\d+)\s*[x×]\s*R\$\s*([\d.,]+)/);
                        if (mainMatch) {
                            const rateMatch = text.match(/([\d.,]+)%\s*ao\s*mês/);
                            results.push({
                                installments: parseInt(mainMatch[1]),
                                monthlyPayment: parseFloat(mainMatch[2].replace(/\./g, '').replace(',', '.')),
                                interestRate: rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) : 0,
                                hasHighChance: text.toLowerCase().includes('alta chance'),
                                description: text.substring(0, 50),
                                source: 'card'
                            });
                        }
                    });

                    // Strategy 2: Broad Fallback (if specific cards failed)
                    if (results.length === 0) {
                        const allDivs = Array.from(document.querySelectorAll('div, span, label'));
                        allDivs.forEach(div => {
                            const text = (div as HTMLElement).innerText;
                            if (!text || text.length > 100) return;

                            const match = text.match(/^(\d+)\s*[x×]\s*R\$\s*([\d.,]+)/);
                            if (match) {
                                results.push({
                                    installments: parseInt(match[1]),
                                    monthlyPayment: parseFloat(match[2].replace(/\./g, '').replace(',', '.')),
                                    interestRate: 0,
                                    hasHighChance: false,
                                    description: text,
                                    source: 'fallback'
                                });
                            }
                        });
                    }
                } catch (e) {
                    // Safe cleanup
                }

                // Deduplicate by installments
                const unique = new Map();
                results.forEach(r => {
                    const existing = unique.get(r.installments);
                    // Prefer offers that captured the rate or came from a specific card selector
                    if (!existing ||
                        (r.source === 'card' && existing.source === 'fallback') ||
                        (r.interestRate > 0 && existing.interestRate === 0) ||
                        (r.hasHighChance && !existing.hasHighChance)) {
                        unique.set(r.installments, r);
                    }
                });

                return Array.from(unique.values()).sort((a: any, b: any) => b.installments - a.installments);
            });

            console.log(`[ItauAdapter] Extracted ${offersData.length} unique offers.`);
            console.log('[ItauAdapter] Offers:', offersData);

            result.offers = offersData.map((o: any) => ({
                bankId: 'itau',
                installments: o.installments,
                monthlyPayment: o.monthlyPayment,
                totalValue: o.installments * o.monthlyPayment,
                interestRate: o.interestRate,
                description: o.description,
                hasHighChance: o.hasHighChance
            })) as SimulationOffer[];

            if (result.offers.length > 0) {
                result.status = 'SUCCESS';
                console.log(`[ItauAdapter] Found ${result.offers.length} offers!`);
            } else {
                console.log('[ItauAdapter] WARNING: No offers matched regex. Check raw text logs.');
            }

        } catch (error: any) {
            console.error('[ItauAdapter] Failed:', error);
        }

        return result;
    }
}
