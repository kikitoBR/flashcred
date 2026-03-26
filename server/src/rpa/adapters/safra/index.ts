import { Page } from 'playwright';
import { BankAdapter, Credential, SimulationInput, SimulationResult, SimulationOffer } from '../../types';

export class SafraAdapter implements BankAdapter {
    id = 'safra';
    name = 'Banco Safra';
    private baseUrl = 'https://financeira.safra.com.br/veiculos/login';
    private simulationUrl = 'https://financeira.safra.com.br/veiculos-pf/simulacao';

    // =============================
    // LOGIN
    // =============================
    async login(page: Page, credentials: Credential): Promise<boolean> {
        console.log(`[SafraAdapter] Logging in as ${credentials.login}...`);
        try {
            // Erase webdriver footprint natively via init scripts
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                // @ts-ignore
                window.chrome = { runtime: {} };
                // Pass permissions test
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters: any) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission } as PermissionStatus) :
                        originalQuery(parameters)
                );
            });

            await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(3000);

            // Check if already logged in (not on login page)
            if (!page.url().includes('/login')) {
                console.log('[SafraAdapter] ✅ Session already active!');
                return true;
            }

            // Fill username
            const usernameField = page.locator('input#usuario');
            await usernameField.waitFor({ state: 'visible', timeout: 15000 });
            await usernameField.click();
            await usernameField.fill('');
            await page.keyboard.type(credentials.login, { delay: 50 });

            // Fill password
            const passwordField = page.locator('input[name="senha"]');
            await passwordField.waitFor({ state: 'visible', timeout: 5000 });
            await passwordField.click();
            await passwordField.fill('');
            await page.keyboard.type(credentials.password || '', { delay: 50 });
            await page.waitForTimeout(500);

            // Click Entrar - Using a more realistic click pattern
            const loginBtn = page.locator('button.entrar');
            await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
            await page.waitForTimeout(500);

            try {
                // First try native playwright click
                await loginBtn.click({ delay: 100 });
            } catch (e) {
                // Fallback: evaluate a deep raw click with events
                await loginBtn.evaluate((node) => {
                    const btn = node as HTMLButtonElement;
                    if (!btn.disabled) {
                        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }
                });
            }

            // Verifica credenciais inválidas antes de esperar o redirecionamento
            try {
                const errorAlert = page.locator('span.text-danger-dark:has-text("Usuário e/ou senha inválido(s)")');
                const hasInvalidCreds = await errorAlert.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
                if (hasInvalidCreds) {
                    console.error('[SafraAdapter] ❌ Login failed — Usuário e/ou senha inválido(s)');
                    throw new Error('Usuário e/ou senha inválido(s)');
                }
            } catch (e: any) {
                if (e.message === 'Usuário e/ou senha inválido(s)') throw e;
            }

            // Wait for redirect away from /login
            try {
                await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 45000 });
                console.log(`[SafraAdapter] ✅ Login OK → ${page.url()}`);

                // CRUCIAL: Wait for the SPA to fully initialize its local tokens before continuing
                await page.waitForTimeout(5000);

                return true;
            } catch {
                if (!page.url().includes('/login')) return true;
                console.error('[SafraAdapter] ❌ Login failed - Timeout waiting for redirect.');
                return false;
            }
        } catch (error: any) {
            console.error('[SafraAdapter] Login exception:', error.message);
            if (error.message === 'Usuário e/ou senha inválido(s)') {
                throw error;
            }
            return false;
        }
    }

    // =============================
    // SIMULATE
    // =============================
    async simulate(page: Page, input: SimulationInput): Promise<SimulationResult> {
        console.log(`[SafraAdapter] Starting simulation for CPF: ${input.client.cpf}`);
        const result: SimulationResult = { bankId: this.id, status: 'ERROR', offers: [] };

        try {
            // ── Step 1: Navigate to simulation page via SPA clicks ──
            console.log('[SafraAdapter] Step 1: Navigating to simulation page...');

            // Wait for Home page to settle
            await page.waitForTimeout(1500);
            try {
                await page.waitForLoadState('networkidle', { timeout: 10000 });
            } catch (e) {
                // Ignore timeout if network doesn't become completely idle
            }

            try {
                console.log('[SafraAdapter] Step 1.1: Clicking "Saiba Mais" inside "Pessoa Física"...');

                // Força o clique via JavaScript puro na DOM, procurando o card de Pessoa Física
                const clickedPessoaFisica = await page.evaluate(() => {
                    const cards = Array.from(document.querySelectorAll('.card-item'));
                    const pFisicaCard = cards.find(c => c.textContent?.includes('Pessoa Física'));
                    if (pFisicaCard) {
                        const saibaMaisBtn = pFisicaCard.querySelector('.card-link') as HTMLElement;
                        if (saibaMaisBtn) {
                            saibaMaisBtn.click();
                            return true;
                        }
                    }
                    return false;
                });

                if (!clickedPessoaFisica) {
                    console.log('[SafraAdapter] Fallback 1.1: Could not click via DOM, trying Playwright locator fallback...');
                    await page.locator('.card-link').filter({ hasText: 'Saiba Mais' }).first().click({ force: true });
                }

                await page.waitForTimeout(3000);

                console.log('[SafraAdapter] Step 1.2: Clicking "Financiamentos"...');

                // Força o clique em financiamentos via JavaScript
                const clickedFinanciamentos = await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button.card-link'));
                    const finBtn = btns.find(b => b.textContent?.includes('Financiamentos')) as HTMLElement;
                    if (finBtn) {
                        finBtn.click();
                        return true;
                    }
                    return false;
                });

                if (!clickedFinanciamentos) {
                    console.log('[SafraAdapter] Fallback 1.2: Could not click via DOM, trying Playwright fallback...');
                    await page.locator('button:has-text("Financiamentos")').click({ force: true });
                }

                console.log('[SafraAdapter] Navigation via UI successful!');
            } catch (e: any) {
                console.error('[SafraAdapter] Failed to navigate via internal buttons:', e.message);
            }

            // Wait for the simulation page layout to appear
            await page.waitForTimeout(5000);

            // ── Step 2: Fill CPF ──
            console.log('[SafraAdapter] Step 2: Filling CPF...');
            const cpfField = page.locator('input#cpfProponente');
            await cpfField.waitFor({ state: 'visible', timeout: 15000 });
            await cpfField.click();
            await cpfField.fill('');
            const cpfClean = input.client.cpf.replace(/\D/g, '');
            await page.keyboard.type(cpfClean, { delay: 50 });
            await page.waitForTimeout(500);
            await page.keyboard.press('Tab');
            await page.waitForTimeout(1000);

            // ── Step 3: Fill CEP ──
            console.log('[SafraAdapter] Step 3: Filling CEP...');
            const cepField = page.locator('input[placeholder="CEP"]');
            await cepField.waitFor({ state: 'visible', timeout: 10000 });
            await cepField.click();
            await cepField.fill('');
            const cepClean = (input.client.zipCode || '20040020').replace(/\D/g, ''); // Usa o CEP do cliente ou um padrão
            await page.keyboard.type(cepClean, { delay: 50 });
            await page.keyboard.press('Tab');
            await page.waitForTimeout(1000);

            // ── Step 4: Fill Celular ──
            console.log('[SafraAdapter] Step 4: Filling Celular...');
            const phoneField = page.locator('input[placeholder="Celular"]');
            await phoneField.waitFor({ state: 'visible', timeout: 10000 });
            await phoneField.click();
            await phoneField.fill('');
            const phoneClean = (input.client.phone || '21999999999').replace(/\D/g, '');
            await page.keyboard.type(phoneClean, { delay: 50 });
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);

            // ── Step 5: Select Vehicle Condition (Novo / Usado) ──
            console.log('[SafraAdapter] Step 5: Selecting vehicle condition...');
            const condition = input.vehicle.condition || 'SEMINOVO';
            if (condition === 'NOVO') {
                const novoBtn = page.locator('button[name="Novo"]');
                await novoBtn.waitFor({ state: 'visible', timeout: 5000 });
                await novoBtn.click();
                console.log('[SafraAdapter] → Selected: Novo');
            } else {
                // SEMINOVO and USADO both map to "Usado" on Safra
                const usadoBtn = page.locator('button[name="Usado"]');
                await usadoBtn.waitFor({ state: 'visible', timeout: 5000 });
                await usadoBtn.click();
                console.log('[SafraAdapter] → Selected: Usado');
            }
            await page.waitForTimeout(1000);

            // ── Step 6: Select UF via ng-select ──
            console.log(`[SafraAdapter] Step 6: Selecting UF: ${input.vehicle.uf}...`);
            const uf = input.vehicle.uf || 'SP';
            await this.selectNgOption(page, '#ufLicenciamento', uf);
            await page.waitForTimeout(1000);

            // ── Step 7: Fill Plate ──
            console.log(`[SafraAdapter] Step 7: Filling plate: ${input.vehicle.plate}...`);
            const plateField = page.locator('input#placa');
            await plateField.waitFor({ state: 'visible', timeout: 10000 });
            await plateField.click();
            await plateField.fill('');
            await page.keyboard.type(input.vehicle.plate.replace(/[^a-zA-Z0-9]/g, ''), { delay: 50 });
            await page.keyboard.press('Tab');
            console.log('[SafraAdapter] → Waiting for version options to load...');
            await page.waitForTimeout(5000);

            // ── Step 8: Select Version (Intelligent Match) ──
            console.log('[SafraAdapter] Step 8: Selecting vehicle version...');
            try {
                const versaoSelect = page.locator('ng-select#versao');
                await versaoSelect.waitFor({ state: 'visible', timeout: 15000 });
                // Click to open the dropdown
                await versaoSelect.locator('.ng-select-container').click();
                await page.waitForTimeout(1500);

                // Fetch all options
                const optionsElements = page.locator('ng-select#versao .ng-option');
                const optionsCount = await optionsElements.count();

                if (optionsCount > 0) {
                    // Clica diretamente na primeira opção
                    console.log('[SafraAdapter] → Selecting the first available version option');
                    await optionsElements.first().click();
                } else {
                    console.warn('[SafraAdapter] ⚠️ No version options loaded in dropdown');
                }

                console.log('[SafraAdapter] → Version selected');
                await page.waitForTimeout(1000);
            } catch (e: any) {
                console.warn('[SafraAdapter] ⚠️ Could not select version:', e.message);
            }

            // ── Step 9: Fill Vehicle Value ──
            console.log(`[SafraAdapter] Step 9: Filling vehicle value: ${input.vehicle.price}...`);
            const valueField = page.locator('input#valorVeiculo');
            await valueField.waitFor({ state: 'visible', timeout: 10000 });
            await valueField.click({ clickCount: 3 }); // Select all
            await page.waitForTimeout(200);
            const formattedPrice = this.formatCurrency(input.vehicle.price);
            await page.keyboard.type(formattedPrice, { delay: 30 });
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);

            // ── Step 10: Fill Down Payment ──
            const downPayment = input.downPayment || 0;
            console.log(`[SafraAdapter] Step 10: Filling down payment: ${downPayment}...`);
            const entryField = page.locator('input#valorEntrada');
            await entryField.waitFor({ state: 'visible', timeout: 10000 });
            await entryField.click({ clickCount: 3 });
            await page.waitForTimeout(200);
            const formattedEntry = this.formatCurrency(downPayment);
            await page.keyboard.type(formattedEntry, { delay: 30 });
            await page.keyboard.press('Tab');
            await page.waitForTimeout(500);

            // ── Step 11: Click Simular ──
            console.log('[SafraAdapter] Step 11: Clicking Simular...');
            const simularBtn = page.locator('button:has(span:text-is("simular")), button:has(span:text-matches("simular", "i"))').first();
            await simularBtn.waitFor({ state: 'visible', timeout: 10000 });
            await simularBtn.click();

            // Wait for results to load
            console.log('[SafraAdapter] → Waiting for simulation results...');
            await page.waitForTimeout(10000);

            // ── Step 12: Select SFR Coefficient ──
            const sfrCoefficient = (input as any).options?.safraCoefficient || 'R5';
            console.log(`[SafraAdapter] Step 12: Selecting SFR coefficient: ${sfrCoefficient}...`);
            try {
                // Tenta selecionar via botão nativamente se existir
                const clickedSfr = await page.evaluate((sfr) => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const targetBtn = btns.find(b => b.textContent?.trim() === sfr);
                    if (targetBtn) {
                        targetBtn.click();
                        return true;
                    }
                    return false;
                }, sfrCoefficient);

                if (clickedSfr) {
                    console.log(`[SafraAdapter] → SFR ${sfrCoefficient} selected via DOM button`);
                } else {
                    console.log('[SafraAdapter] ⚠️ Could not find SFR button, trying ng-select...');
                    // ng-select approach based on HTML <ng-select id="sfr">
                    const ngSelect = page.locator('ng-select#sfr, ng-select[formcontrolname="tipoCoeficiente"]').first();
                    await ngSelect.waitFor({ state: 'attached', timeout: 5000 });
                    await ngSelect.locator('.ng-select-container').click({ force: true });
                    await page.waitForTimeout(500);

                    const option = page.locator(`.ng-option:has-text("${sfrCoefficient}")`).first();
                    await option.click({ force: true });
                    console.log(`[SafraAdapter] → SFR ${sfrCoefficient} selected via ng-select`);
                }
            } catch (e: any) {
                console.warn('[SafraAdapter] ⚠️ Could not select SFR coefficient:', e.message);
            }
            await page.waitForTimeout(1000);

            // ── Step 12b: Select Return (R) ──
            const safraReturn = (input as any).options?.safraReturn || 'R0'; // Define um valor padrão se não vier
            console.log(`[SafraAdapter] Step 12b: Selecting Return (R): ${safraReturn}...`);
            try {
                // Acha o form-group ou div container que possui o texto "Retorno (R)" e foca o ng-select lá dentro
                const returnSelectLocator = page.locator('div, fieldset, .form-group').filter({ hasText: 'Retorno (R)' }).locator('ng-select').first();
                if (await returnSelectLocator.isVisible().catch(() => false) || await returnSelectLocator.count() > 0) {
                    await this.selectNgOption(page, returnSelectLocator, safraReturn);
                } else {
                    // Fallback para procurar ng-select global que tenha no placeholder ou algo associado a retorno
                    const returnSelectFallback = page.locator('ng-select').filter({ hasText: /Retorno/i }).first();
                    if (await returnSelectFallback.count() > 0) {
                        await this.selectNgOption(page, returnSelectFallback, safraReturn);
                    } else {
                        console.log('[SafraAdapter] ⚠️ "Retorno (R)" field not found on screen.');
                    }
                }
            } catch (e: any) {
                console.warn('[SafraAdapter] ⚠️ Error selecting Return (R):', e.message);
            }
            await page.waitForTimeout(1000);

            // ── Step 13: Click Recalcular ──
            console.log('[SafraAdapter] Step 13: Clicking Recalcular...');
            await this.clickRecalcular(page);
            await page.waitForTimeout(8000); // Wait for the first recalculation

            // ── Step 14: Loop through installment plans ──
            const installmentMonths = [60, 48, 42, 36, 30, 24, 18];
            const offers: SimulationOffer[] = [];

            for (let i = 0; i < installmentMonths.length; i++) {
                const months = installmentMonths[i];
                console.log(`[SafraAdapter] Step 14.${i + 1}: Collecting installment ${months}x...`);

                try {
                    // Clica via JS direto na DOM na pílula do mês específico (e.g. "60x")
                    const clickedMonth = await page.evaluate((m) => {
                        // 1) Novo layout: procura pela label ou input correspondente ao mês
                        const labelItem = document.querySelector(`label[for="${m}"]`) as HTMLElement;
                        if (labelItem) {
                            labelItem.click();
                            return true;
                        }

                        // 2) Fallback para layout antigo
                        const allElements = Array.from(document.querySelectorAll('div, span, button'));
                        // Achando a label que tem exatamente "60x", "48x", etc e pareça um boão clicável
                        const btn = allElements.find(el => {
                            const t = el.textContent?.replace(/\s+/g, ' ').trim();
                            // Verifica texto exato e se elemento parece ser parte de um toggle group (classes comuns)
                            return t === `${m}x` && (el.className.includes('btn') || el.className.includes('p-button') || el.closest('.installment-selector, .prazo-container, .btn-group') != null);
                        }) as HTMLElement;

                        if (btn) {
                            btn.click();
                            return true;
                        }

                        // Fallback pra achar em qq lugar
                        const roughMatch = allElements.find(el => el.textContent?.trim() === `${m}x` && el.children.length === 0) as HTMLElement;
                        if (roughMatch) {
                            roughMatch.click();
                            return true;
                        }

                        return false;
                    }, months);

                    if (!clickedMonth) {
                        // Se não clicou pela DOM, tenta via Força Bruta do Playwright
                        try {
                            // Tenta o novo layout primário
                            await page.locator(`label[for="${months}"]`).click({ force: true, timeout: 2000 });
                        } catch {
                            // Fallback
                            await page.locator(`text="${months}x"`).first().click({ force: true, timeout: 2000 }).catch(() => { });
                        }
                    }

                    await page.waitForTimeout(1500); // Aguarda a troca de aba renderizar o valor

                    // Click Recalcular if available - em alguns sistemas de financiamento, clicar no botão não é suficiente
                    try {
                        const clicked = await page.evaluate(() => {
                            const btns = Array.from(document.querySelectorAll('button'));
                            const btn = btns.find(b => b.textContent?.toLowerCase().includes('recalcular'));
                            if (btn && !btn.hasAttribute('disabled')) {
                                btn.click();
                                return true;
                            }
                            return false;
                        });

                        if (clicked) {
                            await page.waitForTimeout(5000); // Espera o safra refazer o request
                        }
                    } catch {
                        // Ignore
                    }

                    // Aguarda mais um pouco para a estabilidade visual da rederização do card
                    await page.waitForTimeout(1500);

                    // Extract the installment value
                    const offerData = await this.extractInstallmentValue(page, months);
                    if (offerData) {
                        offers.push(offerData);
                        console.log(`[SafraAdapter] → ${months}x = R$ ${offerData.monthlyPayment.toFixed(2)} (taxa: ${offerData.interestRate}%)`);
                    } else {
                        console.log(`[SafraAdapter] → No valid installment data found for ${months}x.`);
                    }
                } catch (e: any) {
                    console.warn(`[SafraAdapter] ⚠️ Error collecting ${months}x:`, e.message);
                }
            }

            result.offers = offers;
            result.status = offers.length > 0 ? 'SUCCESS' : 'ERROR';
            result.message = offers.length > 0
                ? `Collected ${offers.length} installment options`
                : 'No installment data could be extracted';

            console.log(`[SafraAdapter] ✅ Simulation complete. ${offers.length} offers collected.`);

        } catch (error: any) {
            console.error('[SafraAdapter] ❌ Simulation error:', error.message);
            result.status = 'ERROR';
            result.message = error.message;

            // Take a screenshot for debugging
            try {
                const screenshotBuffer = await page.screenshot({ fullPage: true });
                result.screenshot = screenshotBuffer.toString('base64');
            } catch { }
        }

        return result;
    }

    // =============================
    // HELPER: Select ng-select option
    // =============================
    private async selectNgOption(page: Page, selectorOrLocator: string | ReturnType<Page['locator']>, value: string): Promise<void> {
        const ngSelect = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator) : selectorOrLocator;
        await ngSelect.waitFor({ state: 'visible', timeout: 10000 });

        // Click to open the dropdown
        await ngSelect.locator('.ng-select-container').click();
        await page.waitForTimeout(500);

        // Type to filter
        const input = ngSelect.locator('input[type="text"]');
        await input.fill('');
        await page.keyboard.type(value, { delay: 100 });
        await page.waitForTimeout(1000);

        // Click on the matching option
        const option = page.locator(`.ng-option:has-text("${value}")`).first();
        try {
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.click();
            const selectorName = typeof selectorOrLocator === 'string' ? selectorOrLocator : 'custom-locator';
            console.log(`[SafraAdapter] → ng-select ${selectorName}: selected "${value}"`);
        } catch {
            // Fallback: press Enter to select the first filtered result
            await page.keyboard.press('Enter');
            const selectorName = typeof selectorOrLocator === 'string' ? selectorOrLocator : 'custom-locator';
            console.log(`[SafraAdapter] → ng-select ${selectorName}: selected via Enter`);
        }
    }

    // =============================
    // HELPER: Click Recalcular button
    // =============================
    private async clickRecalcular(page: Page): Promise<void> {
        const recalcularBtn = page.locator('button:has(span:text-is("Recalcular")), button:has(span:text-matches("recalcular", "i"))').first();
        try {
            await recalcularBtn.waitFor({ state: 'visible', timeout: 8000 });
            await recalcularBtn.click();
        } catch {
            // Fallback: try clicking by evaluation
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const btn = buttons.find(b => b.textContent?.toLowerCase().includes('recalcular'));
                if (btn) btn.click();
            });
        }
    }

    // =============================
    // HELPER: Extract installment value
    // =============================
    private async extractInstallmentValue(page: Page, months: number): Promise<SimulationOffer | null> {
        try {
            const data = await page.evaluate((m) => {
                let monthlyPayment = 0;
                let interestRate = 0;
                let totalValue = 0;

                // 1) Novo layout swiper: tenta extrair direto do label específico (Ex: <label for="60">)
                const labelItem = document.querySelector(`label[for="${m}"]`);
                if (labelItem) {
                    const textContent = labelItem.textContent?.replace(/\s+/g, ' ').replace(/\u00A0/g, ' ').trim() || '';
                    const matchVal = textContent.match(/R\$\s*([\d.,]+)/i);
                    if (matchVal) {
                        monthlyPayment = parseFloat(matchVal[1].replace(/\./g, '').replace(',', '.'));
                    }
                }

                const allElements = Array.from(document.querySelectorAll('*'));

                for (const el of allElements) {
                    const text = el.textContent?.replace(/\s+/g, ' ').trim() || '';

                    // The image shows: "60 PARCELAS DE: R$ 790,86" usually inside a stylized block
                    if (monthlyPayment === 0 && text.match(/PARCELAS\s+DE\s*:\s*R\$\s*([\d.,]+)/i)) {
                        const match = text.match(/PARCELAS\s+DE\s*:\s*R\$\s*([\d.,]+)/i);
                        if (match) {
                            monthlyPayment = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                        }
                    }

                    if (text.match(/taxa|coeficiente/i)) {
                        const rateMatch = text.match(/([\d]+[,.][\d]+)\s*%/);
                        if (rateMatch) {
                            interestRate = parseFloat(rateMatch[1].replace(',', '.'));
                        }
                    }
                }

                // Fallback: If "PARCELAS DE" pattern wasn't matched, find all R$ valid currencies
                // and pick the smallest one (which is the installment, not the total vehicle price)
                if (monthlyPayment === 0) {
                    const priceMatches: number[] = [];
                    for (const el of allElements) {
                        const t = el.textContent?.trim() || '';
                        const match = t.match(/^R\$\s*([\d.,]+)$/);
                        if (match && el.children.length <= 1) { // Avoid huge body elements
                            const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                            if (val > 0) priceMatches.push(val);
                        }
                    }

                    if (priceMatches.length > 0) {
                        // The smallest valid currency value is usually the installment, 
                        // while the larger values are the car price or exact total
                        monthlyPayment = Math.min(...priceMatches);
                    }
                }

                return { monthlyPayment, interestRate, totalValue };
            }, months);

            if (data.monthlyPayment > 0) {
                return {
                    bankId: 'safra',
                    installments: months,
                    monthlyPayment: data.monthlyPayment,
                    interestRate: data.interestRate,
                    totalValue: data.totalValue || data.monthlyPayment * months,
                };
            }

            return null;
        } catch (e: any) {
            console.warn(`[SafraAdapter] extractInstallmentValue error: ${e.message}`);
            return null;
        }
    }

    // =============================
    // HELPER: Format currency (BRL)
    // =============================
    private formatCurrency(value: number | string): string {
        // Format as "50000,00" (no thousands separator, comma as decimal)
        return Number(value).toFixed(2).replace('.', ',');
    }
}
