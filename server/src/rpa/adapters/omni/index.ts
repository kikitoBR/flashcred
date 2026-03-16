import { Page } from 'playwright';
import { BankAdapter, Credential, SimulationInput, SimulationResult, SimulationOffer } from '../../types';

export class OmniAdapter implements BankAdapter {
    id = 'omni';
    name = 'Omni Financeira';
    private baseUrl = 'https://omnimaisweb.omni.com.br/login';

    // =============================
    // LOGIN
    // =============================
    async login(page: Page, credentials: Credential): Promise<boolean> {
        console.log(`[OmniAdapter] Logging in as ${credentials.login}...`);
        try {
            await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(3000);

            if (!page.url().includes('/login')) {
                console.log('[OmniAdapter] ✅ Session already active!');
                return true;
            }

            const usernameField = page.locator('#user-login');
            const passwordField = page.locator('#user-password');
            await usernameField.waitFor({ state: 'visible', timeout: 15000 });
            await passwordField.waitFor({ state: 'visible', timeout: 5000 });

            // Fill with keyboard (Angular-friendly)
            await usernameField.click();
            await usernameField.fill('');
            await page.keyboard.type(credentials.login, { delay: 30 });

            await passwordField.click();
            await passwordField.fill('');
            await page.keyboard.type(credentials.password || '', { delay: 30 });
            await page.waitForTimeout(500);

            // Click Entrar (<a> tag)
            await page.locator('a.btn-login').click({ force: true });

            // Wait for redirect away from /login
            try {
                await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 });
                console.log(`[OmniAdapter] ✅ Login OK → ${page.url()}`);
                return true;
            } catch {
                if (!page.url().includes('/login')) return true;
                console.error('[OmniAdapter] ❌ Login failed.');
                return false;
            }
        } catch (error: any) {
            console.error('[OmniAdapter] Login exception:', error.message);
            return false;
        }
    }

    // =============================
    // SIMULATE
    // =============================
    async simulate(page: Page, input: SimulationInput): Promise<SimulationResult> {
        console.log(`[OmniAdapter] Simulation for CPF: ${input.client.cpf}`);
        const result: SimulationResult = { bankId: this.id, status: 'ERROR', offers: [] };

        try {
            // ── STEP 1: Navigate to /simulador-veiculo ──
            console.log('[OmniAdapter] → Navigating to simulator...');
            try {
                const simNav = page.locator('a[href*="simulador-veiculo"], a:has-text("SIMULADOR")').first();
                await simNav.waitFor({ state: 'visible', timeout: 5000 });
                await simNav.click();
            } catch {
                await page.goto('https://omnimaisweb.omni.com.br/simulador-veiculo', { waitUntil: 'domcontentloaded' });
            }
            await page.waitForTimeout(3000);

            // ── STEP 2: Pessoa Física ──
            console.log('[OmniAdapter] → Pessoa Física...');
            await this.clickSelector(page, 'Pessoa F');
            await page.waitForTimeout(1000);

            // ── STEP 3: Financiamento ──
            console.log('[OmniAdapter] → Financiamento...');
            await this.clickSelector(page, 'Financiamento');
            await page.waitForTimeout(1500);

            // ── STEP 4: Automóveis ──
            console.log('[OmniAdapter] → Automóveis...');
            await this.clickSelector(page, 'Autom');
            await page.waitForTimeout(1500);

            // ── STEP 5: Continuar → Vehicle info page ──
            console.log('[OmniAdapter] → Continuar (to vehicle info)...');
            await this.clickContinuar(page);
            await page.waitForTimeout(3000);

            // ── STEP 6: Ano Modelo (select dropdown) ──
            const yearValue = String(input.vehicle.year);
            console.log(`[OmniAdapter] → Ano Modelo: ${yearValue}`);
            const anoModelo = page.locator('select[formcontrolname="anoModelo"]');
            await anoModelo.waitFor({ state: 'visible', timeout: 10000 });

            // Try by label first, then by value
            try {
                await anoModelo.selectOption({ label: yearValue });
            } catch {
                await anoModelo.selectOption(yearValue);
            }
            await page.waitForTimeout(1500);

            // ── STEP 7: Valor do Veículo ──
            console.log(`[OmniAdapter] → Valor do Veículo: R$ ${input.vehicle.price}`);
            await this.fillMoneyField(page, 'input[formcontrolname="valorVeiculo"]', input.vehicle.price);

            // ── STEP 8: Valor a ser Financiado ──
            const financeValue = input.vehicle.price - (input.downPayment || 0);
            console.log(`[OmniAdapter] → Valor Financiado: R$ ${financeValue}`);
            await this.fillMoneyField(page, 'input[formcontrolname="valorFinanciado"]', financeValue);

            // ── STEP 9: Continuar → Consultando Dados (auto) → Simulação ──
            console.log('[OmniAdapter] → Continuar (to simulation)...');
            await this.clickContinuar(page);

            // Wait for simulation results to load (step 2 is auto, step 3 shows results)
            console.log('[OmniAdapter] ⏳ Waiting for simulation results...');
            await page.waitForTimeout(8000);

            // Wait for PARCELAS section to appear
            try {
                await page.locator('text=PARCELAS').waitFor({ state: 'visible', timeout: 30000 });
                console.log('[OmniAdapter] ✅ Simulation results loaded!');
            } catch {
                console.log('[OmniAdapter] ⚠️ PARCELAS section not found, checking page content...');
                const bodyText = await page.locator('body').innerText();
                console.log(`[OmniAdapter] Page: ${bodyText.substring(0, 500)}`);
            }

            // ── STEP 9.5: Configure Lojista Return ──
            console.log('[OmniAdapter] Step 9.5: Configuring Lojista Return (RE)...');
            try {
                // Click gear icon
                const gearBtn = page.locator('a.icon-full .fa-gear, a.icon-full:has(.fa-gear)').first();
                if (await gearBtn.isVisible({ timeout: 5000 })) {
                    await gearBtn.click({ force: true });
                    await page.waitForTimeout(1500); // Wait for modal animation

                    const omniReturnVal = parseInt((input as any).options?.omniReturn || '0');
                    console.log(`[OmniAdapter] Setting Return value to: ${omniReturnVal}`);

                    if (omniReturnVal >= 0 && omniReturnVal <= 5) {
                        // The Omni slider uses a custom bootstrap-like slider component
                        const sliderHandle = page.locator('slider-retorno .slider-handle[role="slider"], #slider-retorno ~ .slider .slider-handle').first();
                        
                        console.log('[OmniAdapter] Custom slider handle found. Attempting keyboard navigation.');
                        if (await sliderHandle.isVisible({ timeout: 5000 }).catch(() => false)) {
                            // Focus the handle to enable keyboard control (it has tabindex="0")
                            await sliderHandle.click({ force: true });
                            await sliderHandle.focus();
                            await page.waitForTimeout(200);
                            
                            // Reset to 0
                            await page.keyboard.press('Home');
                            await page.waitForTimeout(500);
                            
                            // Increment with exactly the requested value
                            for (let i = 0; i < omniReturnVal; i++) {
                                await page.keyboard.press('ArrowRight');
                                await page.waitForTimeout(300);
                            }
                        } else {
                            console.log('[OmniAdapter] fallback: injecting JS to set custom slider value directly.');
                            // Fallback js injection: update the hidden configuration input
                            await page.evaluate((val) => {
                                const hiddenInput = document.querySelector('#slider-retorno') as HTMLInputElement;
                                if (hiddenInput) {
                                    hiddenInput.value = val.toString();
                                    hiddenInput.setAttribute('value', val.toString());
                                    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                                    hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                            }, omniReturnVal);
                        }
                    }

                    // Click Salvar (targeting the visible one inside the modal)
                    const salvarBtn = page.locator('button.btn-full-orange:has-text("Salvar"):visible').first();
                    await salvarBtn.click();
                    
                    console.log('[OmniAdapter] Aguardando 10 segundos para o recálculo...');
                    await page.waitForTimeout(10000); // Increased from 5s to 10s based on user request
                } else {
                    console.log('[OmniAdapter] ℹ️ Gear icon not found, skipping RE configuration.');
                }
            } catch (e: any) {
                console.warn('[OmniAdapter] ⚠️ Failed to configure Return slider. Error:', e.message);
            }

            // ── STEP 10: Scrape offers ──
            console.log('[OmniAdapter] 📊 Scraping offers...');

            const offersData = await page.evaluate(() => {
                const offers: any[] = [];

                // Strategy 1: Find all installment options in the PARCELAS section
                // Pattern: "12x" + "R$ 2.924,45" displayed as radio/slider options
                const allText = document.body.innerText;

                // Match patterns like "12x\nR$ 2.924,45"
                const regex = /(\d+)x\s*(?:\n|\s)*R\$\s*([\d.,]+)/g;
                let match;
                while ((match = regex.exec(allText)) !== null) {
                    const installments = parseInt(match[1]);
                    const value = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
                    if (installments > 0 && value > 0 && installments <= 120) {
                        offers.push({ installments, monthlyPayment: value });
                    }
                }

                // Strategy 2: Look for structured elements (radio buttons, slider marks)
                if (offers.length === 0) {
                    const elements = document.querySelectorAll('[class*="parcela"], [class*="installment"], .mat-radio-button, input[type="radio"] + label');
                    elements.forEach(el => {
                        const text = (el as HTMLElement).innerText || '';
                        const m = text.match(/(\d+)x.*?R\$\s*([\d.,]+)/);
                        if (m) {
                            offers.push({
                                installments: parseInt(m[1]),
                                monthlyPayment: parseFloat(m[2].replace(/\./g, '').replace(',', '.'))
                            });
                        }
                    });
                }

                // Deduplicate
                const unique = new Map<number, any>();
                offers.forEach(o => unique.set(o.installments, o));
                return Array.from(unique.values()).sort((a, b) => a.installments - b.installments);
            });

            console.log(`[OmniAdapter] Found ${offersData.length} offers:`, offersData);

            // Map to SimulationOffer format
            result.offers = offersData.map((o: any) => ({
                bankId: this.id,
                installments: o.installments,
                monthlyPayment: o.monthlyPayment,
                totalValue: o.installments * o.monthlyPayment,
                interestRate: 0,
                description: `${o.installments}x R$ ${o.monthlyPayment.toFixed(2)}`,
                hasHighChance: false,
            } as SimulationOffer));

            // Try to extract max finance value from the page
            try {
                const maxFinText = await page.locator('text=/Valor Máximo.*R\\$/').first().textContent({ timeout: 3000 });
                if (maxFinText) {
                    console.log(`[OmniAdapter] ${maxFinText.trim()}`);
                }
            } catch { }

            if (result.offers.length > 0) {
                result.status = 'SUCCESS';
                console.log(`[OmniAdapter] ✅ ${result.offers.length} offers scraped!`);
            } else {
                console.warn('[OmniAdapter] ⚠️ No offers found.');
                result.message = 'No installment offers found on results page';
            }

            return result;

        } catch (error: any) {
            console.error('[OmniAdapter] Simulation error:', error.message);
            result.message = error.message;
            return result;
        }
    }

    // =============================
    // HELPERS
    // =============================

    /** Click a div.selector by partial text match */
    private async clickSelector(page: Page, text: string): Promise<void> {
        try {
            const el = page.locator(`div.selector:has-text("${text}"), app-button-selector:has-text("${text}")`).first();
            if (await el.isVisible({ timeout: 3000 })) {
                await el.click();
            }
        } catch {
            console.warn(`[OmniAdapter] Selector "${text}" not found or already selected.`);
        }
    }

    /** Click the Continuar button via JS (Angular SPA has hidden duplicates) */
    private async clickContinuar(page: Page): Promise<void> {
        await page.evaluate(() => {
            const btns = document.querySelectorAll('a.bt-go.btn-full-orange');
            // Click the last visible one (current step)
            const visible = Array.from(btns).filter(el => {
                const rect = (el as HTMLElement).getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            const target = visible.length > 0 ? visible[visible.length - 1] : btns[btns.length - 1];
            if (target) (target as HTMLElement).click();
        });
    }

    /** Fill a money-masked input field */
    private async fillMoneyField(page: Page, selector: string, value: number): Promise<void> {
        const field = page.locator(selector);
        await field.waitFor({ state: 'visible', timeout: 5000 });
        await field.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        // Money mask expects cents
        await page.keyboard.type(Math.round(value * 100).toString(), { delay: 30 });
        await page.keyboard.press('Tab');
        await page.waitForTimeout(1000);
    }
}
