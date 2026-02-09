import { Page } from 'playwright';
import { BankAdapter, Credential, SimulationInput, SimulationResult, SimulationOffer } from '../../types';

export class BvAdapter implements BankAdapter {
    id = 'bv';
    name = 'BV Financeira';
    private baseUrl = 'https://parceiro.bv.com.br/ng-gpar-base-login/';

    async login(page: Page, credentials: Credential): Promise<boolean> {
        console.log(`[BvAdapter] Logging in as ${credentials.login}...`);
        try {
            console.log('[BvAdapter] Navigating to BV portal...');
            await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Wait for page to fully render
            console.log('[BvAdapter] Waiting for page to load...');
            await page.waitForTimeout(5000);

            // Dump page info for debugging
            const pageTitle = await page.title();
            const currentUrl = page.url();
            console.log(`[BvAdapter] Page loaded - Title: "${pageTitle}", URL: ${currentUrl}`);

            // List all inputs on page for debugging
            const allInputs = await page.locator('input').all();
            console.log(`[BvAdapter] Found ${allInputs.length} input fields on page:`);
            for (let i = 0; i < allInputs.length; i++) {
                try {
                    const attrs = await allInputs[i].evaluate(el => ({
                        type: el.getAttribute('type'),
                        name: el.getAttribute('name'),
                        id: el.getAttribute('id'),
                        placeholder: el.getAttribute('placeholder'),
                        class: el.getAttribute('class')?.substring(0, 50)
                    }));
                    console.log(`[BvAdapter] Input ${i}:`, JSON.stringify(attrs));
                } catch { /* skip */ }
            }

            // Wait for user/password fields - try multiple strategies
            let usernameField = null;
            let passwordField = null;

            // Strategy 1: By formControlName (Angular)
            try {
                const userByFormControl = page.locator('input[formcontrolname="login"], input[formcontrolname="usuario"], input[formcontrolname="username"]').first();
                if (await userByFormControl.isVisible({ timeout: 2000 })) {
                    usernameField = userByFormControl;
                    console.log('[BvAdapter] Found username by formcontrolname');
                }
            } catch { }

            // Strategy 2: By type (first text input)
            if (!usernameField) {
                try {
                    const allTextInputs = await page.locator('input[type="text"], input:not([type])').all();
                    for (const inp of allTextInputs) {
                        if (await inp.isVisible({ timeout: 500 })) {
                            usernameField = inp;
                            console.log('[BvAdapter] Found username as first visible text input');
                            break;
                        }
                    }
                } catch { }
            }

            // Find password field
            try {
                const passField = page.locator('input[type="password"]').first();
                if (await passField.isVisible({ timeout: 2000 })) {
                    passwordField = passField;
                    console.log('[BvAdapter] Found password field');
                }
            } catch { }

            if (!usernameField || !passwordField) {
                console.error('[BvAdapter] Could not find login fields!');
                console.log('[BvAdapter] Waiting 30 seconds for manual inspection...');
                await page.waitForTimeout(30000); // Give user time to inspect
                return false;
            }

            // Fill credentials
            console.log('[BvAdapter] Filling username...');
            await usernameField.click({ force: true });
            await page.waitForTimeout(300);
            await usernameField.fill(credentials.login);
            await page.waitForTimeout(500);

            console.log('[BvAdapter] Filling password...');
            await passwordField.click({ force: true });
            await page.waitForTimeout(300);
            await passwordField.fill(credentials.password || '');
            await page.waitForTimeout(500);

            // Check for CAPTCHA and wait for manual resolution
            console.log('[BvAdapter] Checking for CAPTCHA...');
            const captchaSelectors = [
                'iframe[src*="recaptcha"]',
                'iframe[src*="captcha"]',
                '.g-recaptcha',
                '[class*="captcha"]',
                'img[alt*="captcha"]',
                'text=Selecione todas as imagens',
                'text=Verificar'
            ];

            let hasCaptcha = false;
            for (const sel of captchaSelectors) {
                try {
                    const captchaEl = page.locator(sel).first();
                    if (await captchaEl.isVisible({ timeout: 1000 })) {
                        hasCaptcha = true;
                        console.log(`[BvAdapter] CAPTCHA detected with selector: ${sel}`);
                        break;
                    }
                } catch { }
            }

            if (hasCaptcha) {
                console.log('[BvAdapter] ⚠️ CAPTCHA DETECTADO!');
                console.log('[BvAdapter] Por favor, resolva o CAPTCHA manualmente no navegador.');
                console.log('[BvAdapter] Aguardando 60 segundos para resolução manual...');

                // Wait for user to solve captcha (60 seconds max)
                await page.waitForTimeout(60000);

                console.log('[BvAdapter] Tempo esgotado. Continuando...');
            }

            // Find login button
            console.log('[BvAdapter] Looking for login button...');

            // Try multiple strategies to find and click the button
            const buttonStrategies = [
                // Strategy 1: Button with exact text
                async () => {
                    const btn = page.locator('button:has-text("Entrar")').first();
                    if (await btn.isVisible({ timeout: 500 })) {
                        await btn.scrollIntoViewIfNeeded();
                        await btn.click({ force: true });
                        return true;
                    }
                    return false;
                },
                // Strategy 2: Any button with entrar (case insensitive)
                async () => {
                    const btn = page.locator('button').filter({ hasText: /entrar/i }).first();
                    if (await btn.isVisible({ timeout: 500 })) {
                        await btn.click({ force: true });
                        return true;
                    }
                    return false;
                },
                // Strategy 3: Submit button
                async () => {
                    const btn = page.locator('button[type="submit"]').first();
                    if (await btn.isVisible({ timeout: 500 })) {
                        await btn.click({ force: true });
                        return true;
                    }
                    return false;
                },
                // Strategy 4: Click via JavaScript 
                async () => {
                    const clicked = await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const entrarBtn = buttons.find(b => b.textContent?.toLowerCase().includes('entrar'));
                        if (entrarBtn) {
                            (entrarBtn as HTMLButtonElement).click();
                            return true;
                        }
                        return false;
                    });
                    return clicked;
                },
            ];

            let loginClicked = false;
            for (const strategy of buttonStrategies) {
                try {
                    loginClicked = await strategy();
                    if (loginClicked) {
                        console.log('[BvAdapter] Button clicked!');
                        break;
                    }
                } catch { }
            }

            if (!loginClicked) {
                console.log('[BvAdapter] ⚠️ Não consegui clicar no botão Entrar.');
                console.log('[BvAdapter] Por favor, clique no botão ENTRAR manualmente após resolver o CAPTCHA.');
                console.log('[BvAdapter] Aguardando 30 segundos para login manual...');
                await page.waitForTimeout(30000);
            }

            // Wait for navigation
            console.log('[BvAdapter] Waiting for login response...');
            await page.waitForTimeout(5000);

            // Check multiple times (in case page is still loading)
            for (let attempt = 0; attempt < 3; attempt++) {
                const newUrl = page.url();
                console.log(`[BvAdapter] URL check ${attempt + 1}: ${newUrl}`);

                if (!newUrl.toLowerCase().includes('login')) {
                    console.log('[BvAdapter] Login appears successful!');
                    return true;
                }

                await page.waitForTimeout(2000);
            }

            // Check for error messages
            try {
                const errorText = await page.locator('.error, .alert, [class*="error"], [class*="erro"]').first().textContent({ timeout: 2000 });
                if (errorText) {
                    console.error(`[BvAdapter] Login error: ${errorText}`);
                }
            } catch { }

            return false;

        } catch (error: any) {
            console.error('[BvAdapter] Login exception:', error.message);
            return false;
        }
    }

    async simulate(page: Page, input: SimulationInput): Promise<SimulationResult> {
        console.log(`[BvAdapter] Starting simulation for CPF: ${input.client.cpf}...`);
        const result: SimulationResult = { bankId: this.id, status: 'ERROR', offers: [] };

        try {
            // Step 1: Navigate to simulator
            // Look for menu items or links related to simulation
            console.log('[BvAdapter] Looking for simulation menu...');

            const simulatorSelectors = [
                'a:has-text("Simul")',
                'button:has-text("Simul")',
                '[routerlink*="simul"]',
                'a[href*="simul"]',
                '.menu-item:has-text("Simul")',
                'span:has-text("Simulador")',
                'a:has-text("Veículos")',
                'a:has-text("Financiamento")',
            ];

            let foundSimulator = false;
            for (const selector of simulatorSelectors) {
                try {
                    const el = await page.locator(selector).first();
                    if (await el.isVisible({ timeout: 2000 })) {
                        console.log(`[BvAdapter] Found simulator link: ${selector}`);
                        await el.click({ force: true });
                        foundSimulator = true;
                        await page.waitForTimeout(3000);
                        break;
                    }
                } catch { /* continue */ }
            }

            if (!foundSimulator) {
                console.error('[BvAdapter] Could not find simulator menu. Current URL:', page.url());
                result.message = 'Simulator menu not found';
                return result;
            }

            await page.waitForLoadState('networkidle');

            // Step 2: Fill client data (CPF)
            console.log('[BvAdapter] Filling client CPF...');
            const cpfSelectors = [
                'input[name*="cpf"]',
                'input[id*="cpf"]',
                'input[placeholder*="CPF"]',
                'input[formcontrolname*="cpf"]',
                'input[mask="000.000.000-00"]',
            ];

            for (const selector of cpfSelectors) {
                try {
                    const cpfField = await page.locator(selector).first();
                    if (await cpfField.isVisible({ timeout: 2000 })) {
                        await cpfField.click({ force: true });
                        await page.keyboard.press('Control+A');
                        await page.keyboard.press('Backspace');
                        await page.keyboard.type(input.client.cpf.replace(/\D/g, ''), { delay: 50 });
                        console.log('[BvAdapter] CPF filled');
                        await page.waitForTimeout(1000);
                        break;
                    }
                } catch { /* continue */ }
            }

            // Step 3: Fill vehicle data
            console.log('[BvAdapter] Filling vehicle data...');

            // Try to fill plate if available
            if (input.vehicle.plate) {
                const plateSelectors = [
                    'input[name*="placa"]',
                    'input[id*="placa"]',
                    'input[placeholder*="Placa"]',
                    'input[formcontrolname*="placa"]',
                ];
                for (const selector of plateSelectors) {
                    try {
                        const plateField = await page.locator(selector).first();
                        if (await plateField.isVisible({ timeout: 2000 })) {
                            await plateField.click({ force: true });
                            await page.keyboard.type(input.vehicle.plate.toUpperCase(), { delay: 50 });
                            console.log('[BvAdapter] Plate filled');
                            await page.waitForTimeout(1000);
                            break;
                        }
                    } catch { /* continue */ }
                }
            }

            // Fill vehicle value
            const valueSelectors = [
                'input[name*="valor"]',
                'input[id*="valor"]',
                'input[placeholder*="Valor"]',
                'input[formcontrolname*="valor"]',
                'input[name*="value"]',
            ];
            for (const selector of valueSelectors) {
                try {
                    const valueField = await page.locator(selector).first();
                    if (await valueField.isVisible({ timeout: 2000 })) {
                        await valueField.click({ force: true, clickCount: 3 });
                        // BV might use cents format like Itau
                        await page.keyboard.type(String(Math.round(input.vehicle.price * 100)), { delay: 50 });
                        console.log('[BvAdapter] Vehicle value filled');
                        await page.waitForTimeout(1000);
                        break;
                    }
                } catch { /* continue */ }
            }

            // Fill down payment if provided
            if (input.downPayment && input.downPayment > 0) {
                const entrySelectors = [
                    'input[name*="entrada"]',
                    'input[id*="entrada"]',
                    'input[placeholder*="Entrada"]',
                    'input[formcontrolname*="entrada"]',
                ];
                for (const selector of entrySelectors) {
                    try {
                        const entryField = await page.locator(selector).first();
                        if (await entryField.isVisible({ timeout: 2000 })) {
                            await entryField.click({ force: true, clickCount: 3 });
                            await page.keyboard.type(String(Math.round(input.downPayment * 100)), { delay: 50 });
                            console.log('[BvAdapter] Down payment filled');
                            await page.waitForTimeout(1000);
                            break;
                        }
                    } catch { /* continue */ }
                }
            }

            // Step 4: Click simulate button
            console.log('[BvAdapter] Looking for simulate button...');
            const simButtonSelectors = [
                'button:has-text("Simular")',
                'button:has-text("Calcular")',
                'button:has-text("Consultar")',
                'button[type="submit"]',
                'input[type="submit"]',
            ];

            for (const selector of simButtonSelectors) {
                try {
                    const btn = await page.locator(selector).first();
                    if (await btn.isVisible({ timeout: 2000 })) {
                        await btn.click({ force: true });
                        console.log(`[BvAdapter] Clicked simulate button: ${selector}`);
                        break;
                    }
                } catch { /* continue */ }
            }

            // Wait for results
            await page.waitForTimeout(8000);
            await page.waitForLoadState('networkidle');

            // Step 5: Scrape offers
            console.log('[BvAdapter] Scraping offers...');

            const offersData = await page.evaluate(() => {
                const results: any[] = [];

                try {
                    // Look for cards, tables, or any container with offer data
                    const containers = Array.from(document.querySelectorAll(
                        '.card, .offer, .resultado, .parcela, tr, .item, div[class*="result"], div[class*="offer"]'
                    ));

                    for (const container of containers) {
                        const text = (container as HTMLElement).innerText || '';
                        if (!text) continue;

                        // Match patterns like "48x R$ 1.000,00" or "Parcela: R$ 1.000,00"
                        const installmentMatch = text.match(/(\d+)\s*[x×]\s*R?\$?\s*([\d.,]+)/i);
                        const rateMatch = text.match(/([\d.,]+)\s*%/);

                        if (installmentMatch) {
                            results.push({
                                installments: parseInt(installmentMatch[1]),
                                monthlyPayment: parseFloat(installmentMatch[2].replace(/\./g, '').replace(',', '.')),
                                interestRate: rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) : 0,
                                hasHighChance: text.toLowerCase().includes('aprovad') || text.toLowerCase().includes('pré-aprovad'),
                                description: text.substring(0, 80)
                            });
                        }
                    }

                    // Fallback: scan all text nodes
                    if (results.length === 0) {
                        const allText = document.body.innerText;
                        const matches = allText.matchAll(/(\d+)\s*[x×]\s*R?\$?\s*([\d.,]+)/gi);
                        for (const match of matches) {
                            results.push({
                                installments: parseInt(match[1]),
                                monthlyPayment: parseFloat(match[2].replace(/\./g, '').replace(',', '.')),
                                interestRate: 0,
                                hasHighChance: false,
                                description: 'Extracted from page text'
                            });
                        }
                    }

                    // Deduplicate by installments
                    const unique = new Map();
                    results.forEach(r => {
                        if (!unique.has(r.installments) || (r.interestRate > 0 && unique.get(r.installments).interestRate === 0)) {
                            unique.set(r.installments, r);
                        }
                    });

                    return Array.from(unique.values()).sort((a, b) => b.installments - a.installments);
                } catch (e) {
                    return [];
                }
            });

            console.log(`[BvAdapter] Extracted ${offersData.length} offers`);
            console.log('[BvAdapter] Offers:', offersData);

            result.offers = offersData.map((o: any) => ({
                bankId: 'bv',
                installments: o.installments,
                monthlyPayment: o.monthlyPayment,
                totalValue: o.installments * o.monthlyPayment,
                interestRate: o.interestRate,
                description: o.description,
                hasHighChance: o.hasHighChance
            })) as SimulationOffer[];

            if (result.offers.length > 0) {
                result.status = 'SUCCESS';
                console.log(`[BvAdapter] Found ${result.offers.length} offers!`);
            } else {
                result.message = 'No offers found on page';
                console.log('[BvAdapter] WARNING: No offers matched. Check page state.');
            }

        } catch (error: any) {
            console.error('[BvAdapter] Simulation failed:', error.message);
            result.message = error.message;
        }

        return result;
    }
}
