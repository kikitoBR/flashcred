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
            return true;
        } catch (error) {
            return false;
        }
    }

    async simulate(page: Page, input: SimulationInput): Promise<SimulationResult> {
        console.log(`[ItauAdapter] Starting simulation for CPF: ${input.client.cpf}...`);
        const result: SimulationResult = { bankId: this.id, status: 'ERROR', offers: [] };

        try {
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

                        console.log(`[ItauAdapter] Typing new value: ${input.downPayment}`);
                        await page.keyboard.type(input.downPayment.toString(), { delay: 100 });
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

            // SCRAPE OFFERS
            console.log('[ItauAdapter] Scraping offers (v3 - Broad)...');

            // Wait for whatever container holds results
            await page.waitForTimeout(2000);

            const pageContent = await page.content();
            // Optional: Save page content for debug if in dev mode
            // fs.writeFileSync('debug_offers_page.html', pageContent);

            const offers = await page.evaluate(() => {
                // Try specific cards first
                let cards = Array.from(document.querySelectorAll('.ids-card, .offer-card, app-simulation-card'));

                // If no cards, try broad search for any block with "x R$" (installments pattern)
                if (cards.length === 0) {
                    // Look for text nodes or simpler containers
                    const allDivs = Array.from(document.querySelectorAll('div, span, p'));
                    return allDivs
                        .map(d => (d as HTMLElement).innerText?.replace(/\n/g, ' ').trim())
                        .filter(t => t && /\d+\s*[x×]\s*R\$/.test(t)) // Must contain "Nx R$"
                        .filter((t, i, self) => self.indexOf(t) === i) // Unique
                        .slice(0, 10); // Limit to avoid spam
                }

                return cards.map(c => {
                    return (c as HTMLElement).innerText.replace(/\n/g, ' ').trim();
                }).filter(t => (t.includes('R$') && (t.includes('x') || t.includes('×'))) || t.includes('meses'));
            });

            console.log(`[ItauAdapter] Extracted ${offers.length} potential offer strings.`);
            console.log('[ItauAdapter] Raw strings:', offers);

            result.offers = offers.map(text => {
                // Regex matches: "48x R$ 866,00", "48 x R$ 866,00", "48 vezes de R$ ..."
                const match = text.match(/(\d+)\s*[x×vezes\sde]+\s*R\$?\s*([\d.,]+)/i);
                if (match) {
                    return {
                        bankId: 'itau',
                        installments: parseInt(match[1]),
                        monthlyPayment: parseFloat(match[2].replace(/\./g, '').replace(',', '.')),
                        totalValue: 0,
                        interestRate: 0,
                        description: text.substring(0, 100)
                    };
                }
                return null;
            }).filter(o => o !== null && o.installments > 0) as SimulationOffer[];

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
