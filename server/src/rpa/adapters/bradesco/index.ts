import { Page } from 'playwright';
import { BankAdapter, Credential, SimulationInput, SimulationResult, SimulationOffer } from '../../types';

export class BradescoAdapter implements BankAdapter {
    id = 'bradesco';
    name = 'Bradesco Financiamentos';
    private baseUrl = 'https://turbo.bradesco/originacaolojista/login';

    // =============================
    // LOGIN
    // =============================
    async login(page: Page, credentials: Credential): Promise<boolean> {
        console.log(`[BradescoAdapter] Logging in as ${credentials.login}...`);
        try {
            // Bypass webdriver footprint to prevent bot detection
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                // Automatically handle geolocation permission inside the page context via mock if necessary
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters: any) => (
                    parameters.name === 'geolocation' ?
                        Promise.resolve({ state: 'granted' } as PermissionStatus) :
                        originalQuery(parameters)
                );
            });

            await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(3000);

            // Check if already logged in (not on login page)
            if (!page.url().includes('login')) {
                console.log('[BradescoAdapter] ✅ Session already active!');
                return true;
            }

            // Fill username (CPF)
            const usernameField = page.locator('input[formcontrolname="username"], input[mask="000.000.000-00"]').first();
            await usernameField.waitFor({ state: 'visible', timeout: 15000 });
            await usernameField.click();
            await usernameField.fill('');
            await page.keyboard.type(credentials.login.replace(/\D/g, ''), { delay: 50 });

            // Fill password
            const passwordField = page.locator('input[formcontrolname="password"], input[type="password"]').first();
            await passwordField.waitFor({ state: 'visible', timeout: 5000 });
            await passwordField.click();
            await passwordField.fill('');
            await page.keyboard.type(credentials.password || '', { delay: 50 });
            await page.waitForTimeout(500);

            // Click Entrar
            const loginBtn = page.locator('button[type="submit"]:has-text("Entrar")').first();
            await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
            
            // Try standard click, fallback to JS event evaluation if intercepted
            try {
                await loginBtn.click({ delay: 100 });
            } catch (e) {
                await loginBtn.evaluate((node) => {
                    const btn = node as HTMLButtonElement;
                    if (!btn.disabled) {
                        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }
                });
            }

            // Wait for navigation away from login
            try {
                await page.waitForURL(url => !url.toString().includes('login'), { timeout: 45000 });
                console.log(`[BradescoAdapter] ✅ Login OK → ${page.url()}`);
                await page.waitForTimeout(3000); // SPA stabilization
                return true;
            } catch {
                if (!page.url().includes('login')) return true;
                console.error('[BradescoAdapter] ❌ Login failed - Timeout waiting for redirect.');
                return false;
            }
        } catch (error: any) {
            console.error('[BradescoAdapter] Login exception:', error.message);
            return false;
        }
    }

    // =============================
    // SIMULATE
    // =============================
    async simulate(page: Page, input: SimulationInput): Promise<SimulationResult> {
        console.log(`[BradescoAdapter] Starting simulation for CPF: ${input.client.cpf}`);
        const result: SimulationResult = { bankId: this.id, status: 'ERROR', offers: [] };

        try {
            // We use JS location overrides or standard Playwright permission context instead
            // Assuming the orchestrator gave us the geolocation permission

            // ── Step 1: Click Nova Proposta ──
            console.log('[BradescoAdapter] Step 1: Clicking "Nova proposta"...');
            await page.waitForTimeout(2000);
            const novaPropostaBtn = page.locator('.button-new-proposal, button:has-text("Nova proposta")').first();
            await novaPropostaBtn.waitFor({ state: 'visible', timeout: 15000 });
            await novaPropostaBtn.click({ force: true });
            
            // ── Step 2: Fill Client CPF & Celular ──
            console.log('[BradescoAdapter] Step 2: Filling Client CPF and Celular...');
            const cpfField = page.locator('input[formcontrolname="numeroDocumento"], input[mask="000.000.000-00"]').last();
            await cpfField.waitFor({ state: 'visible', timeout: 15000 });
            await cpfField.click();
            await cpfField.fill('');
            await page.keyboard.type(input.client.cpf.replace(/\D/g, ''), { delay: 50 });
            await page.waitForTimeout(500);

            const phoneField = page.locator('input[formcontrolname="celular"]').first();
            await phoneField.waitFor({ state: 'visible', timeout: 5000 });
            await phoneField.click();
            await phoneField.fill('');
            const phoneClean = (input.client.phone || '11999999999').replace(/\D/g, '');
            await page.keyboard.type(phoneClean, { delay: 50 });
            
            // ── Step 3: Avançar ──
            const avancarBtn1 = page.locator('button:has-text("Avançar")').first();
            await avancarBtn1.click();
            await page.waitForTimeout(3000); // Wait for modal animation or navigation

            // ── Step 4: Handle User Info Modal ──
            // Sometimes it asks for birthDate and gender if it's a new or unverified client
            console.log('[BradescoAdapter] Step 4: Checking for extra info modal...');
            const birthDateField = page.locator('input[formcontrolname="dataDeNascimento"]').first();
            const isModalVisible = await birthDateField.isVisible().catch(() => false);
            
            if (isModalVisible) {
                console.log('[BradescoAdapter] → Modal identified. Filling Birth Date and Gender...');
                await birthDateField.click();
                await birthDateField.fill('');
                // Assuming format DDMMYYYY or DD/MM/YYYY
                const birthClean = (input.client.birthDate || '01/01/1990').replace(/\D/g, '');
                await page.keyboard.type(birthClean, { delay: 50 });

                // Find Gender Combobox: According to md, it just says "selecionar o sexo" via mat-select
                const sexoSelect = page.locator('mat-select[formcontrolname="sexo"], .mat-select-trigger').first();
                if (await sexoSelect.isVisible()) {
                    await sexoSelect.click();
                    await page.waitForTimeout(500);
                    // Just select the first available valid option (M or F)
                    await page.keyboard.press('ArrowDown');
                    await page.keyboard.press('Enter');
                }

                // Click Confirmar on Modal
                const confirmarModalBtn = page.locator('button:has-text("Confirmar")').first();
                await confirmarModalBtn.click();
                await page.waitForTimeout(2000);
                
                // Click Avançar again if present
                const avancarBtn2 = page.locator('button:has-text("Avançar")').first();
                if (await avancarBtn2.isVisible()) {
                    await avancarBtn2.click();
                    await page.waitForTimeout(2000);
                }
            }

            // ── Step 5: Fill UF & Plate ──
            console.log('[BradescoAdapter] Step 5: Filling UF and Plate...');
            const uf = input.vehicle.uf || 'SP';
            await this.selectMatOption(page, 'mat-select[formcontrolname="ufDeLicenciamento"]', uf);
            
            const plateField = page.locator('input[formcontrolname="plateNumber"]').first();
            await plateField.waitFor({ state: 'visible', timeout: 5000 });
            await plateField.click();
            await plateField.fill('');
            await page.keyboard.type(input.vehicle.plate.replace(/[^a-zA-Z0-9]/g, ''), { delay: 50 });
            await page.waitForTimeout(1000);

            // Wait for vehicle version modal and handle it
            console.log('[BradescoAdapter] Step 6: Handling vehicle version modal...');
            const firstRadioOption = page.locator('.mat-radio-button, input[type="radio"].mat-radio-input').first();
            await firstRadioOption.waitFor({ state: 'visible', timeout: 15000 });
            await firstRadioOption.click({ force: true });
            await page.waitForTimeout(1000);

            // Modal footer Avançar/Confirmar
            const modalFooterConfirm = page.locator('#modal-footer button:has-text("Confirmar")').first();
            await modalFooterConfirm.click();
            await page.waitForTimeout(3000);

            // ── Step 7: Fill Vehicle Value & Down Payment ──
            console.log(`[BradescoAdapter] Step 7: Filling values... Vehicle: ${input.vehicle.price}, Entry: ${input.downPayment}`);
            const valorVeiculoField = page.locator('input[formcontrolname="valorDoVeiculo"]').first();
            await valorVeiculoField.waitFor({ state: 'visible', timeout: 10000 });
            await valorVeiculoField.click({ clickCount: 3 });
            await page.waitForTimeout(200);
            await page.keyboard.type(this.formatCurrency(input.vehicle.price), { delay: 30 });
            
            const downPayment = input.downPayment || 0;
            const entryField = page.locator('input[formcontrolname="valorDeEntrada"]').first();
            await entryField.click({ clickCount: 3 });
            await page.waitForTimeout(200);
            await page.keyboard.type(this.formatCurrency(downPayment), { delay: 30 });
            await page.keyboard.press('Tab');

            console.log('[BradescoAdapter] Aguardando o cálculo do valor de entrada...');
            await page.waitForTimeout(5000); // Delay extra para cálculo

            console.log('[BradescoAdapter] Step 8: Clicking Avançar for the simulation...');
            const avancarBtn3 = page.locator('button.mat-primary:has-text("Avançar")').last();
            await avancarBtn3.click();

            // Intercept location popup if it happens right here
            console.log('[BradescoAdapter] Aguardando 30 segundos para o processamento da simulação...');
            await page.waitForTimeout(30000); // 30s as requested by user

            // ── Step 9: Configure Return (RE) ──
            console.log('[BradescoAdapter] Step 9: Configuring Lojista Return (RE)...');
            try {
                // Click the pencil/edit icon for 'Retorno do lojista' using the specific row structural class
                const reRow = page.locator('.configuracoes-row:has-text("Retorno do lojista")').last();
                await reRow.click({ force: true });
                await page.waitForTimeout(1000);

                const reInput = page.locator('input[formcontrolname="rePercentage"]').first();
                await reInput.waitFor({ state: 'visible', timeout: 15000 }); // Aumentado para 15s
                await reInput.click({ clickCount: 3 });
                
                // Get configured RE from the frontend options, fallback to '0'
                const reCoefficientStr = (input as any).options?.bradescoReturn || '0';
                
                // Se o frontend mandar "6", ao digitar "6" na mascara ele formata "0,6%"
                // Precisamos enviar "600" para virar "6,00%"
                const reCoefficientValue = parseFloat(reCoefficientStr);
                const typedValue = isNaN(reCoefficientValue) ? '0' : (reCoefficientValue * 100).toString();
                
                await page.keyboard.type(typedValue, { delay: 50 });
                await page.waitForTimeout(500);

                // Click 'Continuar' instead of hitting Enter
                const continuarBtn = page.locator('button.action-button:has-text("Continuar")').first();
                if (await continuarBtn.isVisible()) {
                    await continuarBtn.click();
                } else {
                    await page.keyboard.press('Enter'); // Fallback
                }
                
                console.log('[BradescoAdapter] Aguardando 20 segundos para o recálculo...');
                await page.waitForTimeout(20000); // 20s for recalculation as requested
            } catch (e: any) {
                console.warn('[BradescoAdapter] ⚠️ Failed to configure RE, proceeding with default. Error:', e.message);
            }

            // ── Step 10: Extract Installments ──
            console.log('[BradescoAdapter] Step 10: Extracting simulation installments...');
            const offers: SimulationOffer[] = [];
            
            try {
                // Wait for the toggles containing parts
                const installmentContainer = page.locator('wl-payment-installment-toggle');
                await installmentContainer.waitFor({ state: 'visible', timeout: 15000 });

                // Fetch all buttons with class "parcela-button"
                const buttons = page.locator('.parcela-button');
                const count = await buttons.count();

                console.log(`[BradescoAdapter] Found ${count} installment options.`);
                for (let i = 0; i < count; i++) {
                    const btn = buttons.nth(i);
                    const text = await btn.textContent() || '';
                    
                    // Format is usually: "60x de R$ 875,08"
                    const monthsMatch = text.match(/(\d+)\s*x/i);
                    const valueMatch = text.match(/R\$\s*([\d.,]+)/i);

                    if (monthsMatch && valueMatch) {
                        const months = parseInt(monthsMatch[1], 10);
                        const monthlyPayment = parseFloat(valueMatch[1].replace(/\./g, '').replace(',', '.'));
                        
                        offers.push({
                            bankId: this.id,
                            installments: months,
                            monthlyPayment: monthlyPayment,
                            interestRate: 0, // Not explicitly visible easily without expanding more UI components
                            totalValue: monthlyPayment * months
                        });
                        console.log(`[BradescoAdapter] → ${months}x = R$ ${monthlyPayment.toFixed(2)}`);
                    }
                }
            } catch (e: any) {
                console.warn('[BradescoAdapter] ⚠️ Error extracting installments:', e.message);
            }

            result.offers = offers;
            result.status = offers.length > 0 ? 'SUCCESS' : 'ERROR';
            result.message = offers.length > 0 
                ? `Collected ${offers.length} installment options` 
                : 'No installment data could be extracted';

            console.log(`[BradescoAdapter] ✅ Simulation complete. ${offers.length} offers collected.`);

        } catch (error: any) {
            console.error('[BradescoAdapter] ❌ Simulation error:', error.message);
            result.status = 'ERROR';
            result.message = error.message;

            try {
                const screenshotBuffer = await page.screenshot({ fullPage: true });
                result.screenshot = screenshotBuffer.toString('base64');
            } catch {}
        }

        return result;
    }

    // =============================
    // HELPER: Select mat-select option
    // =============================
    private async selectMatOption(page: Page, selector: string, value: string): Promise<void> {
        const matSelect = page.locator(selector).first();
        try {
            await matSelect.waitFor({ state: 'visible', timeout: 10000 });
            await matSelect.click();
            await page.waitForTimeout(500);

            // Using evaluate to click the specific option directly in the overlay
            await page.evaluate((val) => {
                const options = Array.from(document.querySelectorAll('mat-option, .mat-option-text'));
                // Find option that contains the text
                const target = options.find(opt => opt.textContent?.trim().toUpperCase().includes(val.toUpperCase()));
                if (target) {
                    (target as HTMLElement).click();
                }
            }, value);

            console.log(`[BradescoAdapter] → mat-select ${selector}: selected "${value}"`);
        } catch (e) {
            console.warn(`[BradescoAdapter] Failed to select option ${value} on ${selector}`);
        }
    }

    // =============================
    // HELPER: Format currency (BRL)
    // =============================
    private formatCurrency(value: number | string): string {
        return Number(value).toFixed(2).replace('.', ',');
    }
}
