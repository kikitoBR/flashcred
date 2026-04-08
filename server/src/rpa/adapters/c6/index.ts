import { Page } from 'playwright';
import { BankAdapter, Credential, SimulationInput, SimulationResult, SimulationOffer } from '../../types';

export class C6Adapter implements BankAdapter {
    id = 'c6';
    name = 'C6 Bank';
    private baseUrl = 'https://c6auto.com.br/originacaolojista/login';

    // =============================
    // LOGIN
    // =============================
    async login(page: Page, credentials: Credential): Promise<boolean> {
        console.log(`[C6Adapter] Logging in as ${credentials.login}...`);
        try {
            await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(3000);

            if (!page.url().includes('login')) {
                console.log('[C6Adapter] ✅ Session already active!');
                return true;
            }

            // Click start login button
            const startLoginBtn = page.locator('button#submit-button', { hasText: 'Iniciar Login' });
            if (await startLoginBtn.isVisible({ timeout: 5000 })) {
                await startLoginBtn.click();
                await page.waitForTimeout(2000);
            }

            const usernameField = page.locator('#username');
            const passwordField = page.locator('#password');
            await usernameField.waitFor({ state: 'visible', timeout: 15000 });

            await usernameField.fill('');
            await page.keyboard.type(credentials.login, { delay: 30 });

            await passwordField.fill('');
            await page.keyboard.type(credentials.password || '', { delay: 30 });
            await page.waitForTimeout(500);

            // Click Acessar
            await page.locator('#kc-login').click({ force: true });

            // Check for invalid credentials message before waiting for redirect
            try {
                const errorAlert = page.locator('#input-error:has-text("Invalid username or password")');
                const hasInvalidCreds = await errorAlert.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
                if (hasInvalidCreds) {
                    console.error('[C6Adapter] ❌ Login failed — Invalid username or password.');
                    throw new Error('Usuário e/ou senha inválido(s)');
                }
            } catch (e: any) {
                if (e.message === 'Usuário e/ou senha inválido(s)') throw e;
            }

            // Wait for redirect to portal home
            try {
                await page.waitForURL(url => !url.toString().includes('/login') && !url.toString().includes('auth'), { timeout: 20000 });
                console.log(`[C6Adapter] ✅ Login OK → ${page.url()}`);

                // Handle Promo Banner
                try {
                    const bannerCloseBtn = page.locator('app-massive-communication-modal button[mat-dialog-close]').first();
                    await bannerCloseBtn.waitFor({ state: 'visible', timeout: 10000 });
                    await bannerCloseBtn.click({ force: true });
                    console.log('[C6Adapter] Promo banner closed.');
                    await page.waitForTimeout(1000);
                } catch { }

                return true;
            } catch {
                if (!page.url().includes('login')) return true;
                console.error('[C6Adapter] ❌ Login failed.');
                return false;
            }
        } catch (error: any) {
            console.error('[C6Adapter] Login exception:', error.message);
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
        console.log(`[C6Adapter] Simulation for CPF: ${input.client.cpf}`);
        const result: SimulationResult = { bankId: this.id, status: 'ERROR', offers: [] };

        try {
            // Check promo banner again just in case
            try {
                const bannerCloseBtn = page.locator('app-massive-communication-modal button[mat-dialog-close]').first();
                await bannerCloseBtn.waitFor({ state: 'visible', timeout: 5000 });
                await bannerCloseBtn.click({ force: true });
                console.log('[C6Adapter] Promo banner closed (second attempt).');
                await page.waitForTimeout(1000);
            } catch { }

            // ── STEP 1: New Proposal ──
            console.log('[C6Adapter] → Creating new proposal...');
            const newProposalBtn = page.locator('button.button-new-proposal');
            await newProposalBtn.waitFor({ state: 'visible', timeout: 15000 });
            await newProposalBtn.click();
            await page.waitForTimeout(3000);

            // ── STEP 2: Client Info ──
            console.log('[C6Adapter] → Filling client data...');

            // Format data
            const cleanCpf = input.client.cpf.replace(/\D/g, '');
            const cleanPhone = (input.client.phone || '').replace(/\D/g, '');
            let birthDate = '01011980'; // fallback
            if (input.client.birthDate) {
                const parts = input.client.birthDate.split('T')[0].split('-');
                if (parts.length === 3) {
                    birthDate = `${parts[2]}${parts[1]}${parts[0]}`; // DDMMYYYY
                } else {
                    birthDate = input.client.birthDate.replace(/\D/g, '');
                }
            }

            await page.locator('input[formcontrolname="numeroDocumento"]').fill(cleanCpf);
            await page.locator('input[formcontrolname="celular"]').fill(cleanPhone);
            await page.locator('input[formcontrolname="dataDeNascimento"]').fill(birthDate);

            // UF de Licenciamento (mat-select)
            console.log(`[C6Adapter] → Seclecting UF: ${input.vehicle.uf}`);
            await page.locator('mat-select[formcontrolname="ufDeLicenciamento"]').click();
            await page.waitForTimeout(1000);
            await page.locator(`mat-option:has-text("${input.vehicle.uf}")`).first().click();

            // ── STEP 3: Vehicle Info ──
            console.log(`[C6Adapter] → Filling vehicle data (Plate: ${input.vehicle.plate})...`);

            // Plate handles auto-complete
            const plateField = page.locator('input[formcontrolname="plateNumber"]');
            await plateField.fill(input.vehicle.plate.replace(/\W/g, ''));
            // Press Tab to trigger the blur event which fires the search
            await plateField.press('Tab');

            // Wait for system to autocomplete vehicle info
            console.log('[C6Adapter] ⏳ Waiting 8s for Detran/FIPE plate consultation...');
            await page.waitForTimeout(8000);

            // Money fields (Currency masks often need clear/type tricks)
            console.log(`[C6Adapter] → Financials - Price: R$ ${input.vehicle.price}, Entry: R$ ${input.downPayment}`);
            await this.fillMoneyField(page, 'input[formcontrolname="valorDoVeiculo"]', input.vehicle.price);
            await this.fillMoneyField(page, 'input[formcontrolname="valorDeEntrada"]', input.downPayment || 0);

            // ── STEP 4: Simulate ──
            console.log('[C6Adapter] → Clicking Simular...');
            const simulateBtn = page.locator('button:has-text("Simular")').first();
            await simulateBtn.click();

            // ── Wait for Simulation Results ──
            console.log('[C6Adapter] ⏳ Waiting for simulation results...');
            try {
                // Race between success (button.parcela-button) and rejection modal (app-simulation-not-completed-modal)
                const raceResult = await Promise.race([
                    page.waitForSelector('button.parcela-button', { state: 'visible', timeout: 35000 }).then(() => 'APPROVED'),
                    page.waitForSelector('app-simulation-not-completed-modal', { state: 'visible', timeout: 35000 }).then(() => 'REJECTED')
                ]);

                if (raceResult === 'REJECTED') {
                    console.log('[C6Adapter] ❌ Rejection modal detected. Extracting message...');
                    // Extract the text
                    const title = await page.locator('app-simulation-not-completed-modal h2').innerText().catch(() => 'Proposta recusada');
                    const reason = await page.locator('app-simulation-not-completed-modal p').innerText().catch(() => 'Não atende aos requisitos');
                    
                    result.status = 'ERROR'; // or 'REJECTED' based on the system typing. But frontend shows 'REJECTED' if we pass it, actually let's check types.
                    // Wait, earlier I saw the frontend check sim.status === 'REJECTED'. So I'll use 'REJECTED'. 
                    // Let's modify result to REJECTED.
                    result.status = 'REJECTED';
                    result.message = 'Cliente não aprovado: Não temos condições aprováveis para este cliente.';
                    
                    console.log(`[C6Adapter] Rejection reason: ${result.message}`);
                    
                    // Click the close button so the page is clean
                    const closeModalBtn = page.locator('app-simulation-not-completed-modal button[mat-dialog-close]').first();
                    if (await closeModalBtn.isVisible({ timeout: 2000 })) {
                        await closeModalBtn.click({ force: true });
                    }
                    
                    return result;
                }

                // Se chegou aqui, foi aprovado/tem parcelas
                await page.waitForTimeout(2000);
            } catch (e) {
                console.log('[C6Adapter] ⏳ TIMEOUT: Neither success buttons nor rejection modal appeared in 35s. Proceeding...');
            }

            // ── STEP 5: Dealer Return (Configurações do Lojista) ──
            const dealerReturnStr = input.options?.dealerReturn || 'R0';
            const dealerReturnNum = parseInt(dealerReturnStr.replace('R', ''), 10) || 0;

            if (dealerReturnNum > 0 && dealerReturnNum <= 6) {
                console.log(`[C6Adapter] → Dealer Return requested: ${dealerReturnNum}% (${dealerReturnStr}). Expanding "Configurações do lojista"...`);
                try {
                    // Try to click the accordion if it's closed
                    const configBtn = page.locator('span:has-text("Configurações do lojista")').first();
                    if (await configBtn.isVisible({ timeout: 3000 })) {
                        await configBtn.click();
                        await page.waitForTimeout(2000);

                        console.log(`[C6Adapter] → Setting Rate to ${dealerReturnNum}...`);

                        // (1) Select the explicitly mapped percentage input field
                        const targetInput = page.locator('input[formcontrolname="percentage"]').first();

                        if (await targetInput.isVisible({ timeout: 2000 })) {
                            // C6 mask often requires clearing properly before typing
                            await targetInput.click({ clickCount: 3 });
                            await page.keyboard.press('Backspace');
                            await page.keyboard.type(dealerReturnNum.toString(), { delay: 50 });
                        } else {
                            console.log('[C6Adapter] ⚠️ Input de percentage não visível.');
                        }

                        // (2) Find and click the explicit Confirmar button
                        console.log('[C6Adapter] → Clicking Confirmar to trigger recalculation...');
                        const confirmBtn = page.locator('span.mat-button-wrapper:has-text("Confirmar")').first();

                        if (await confirmBtn.isVisible({ timeout: 2000 })) {
                            await confirmBtn.click();
                            console.log('[C6Adapter] ⏳ Waiting for recalculation to finish...');
                            // Wait for the overlay/loading context to disappear
                            await page.waitForTimeout(6000);
                        } else {
                            console.log('[C6Adapter] ⚠️ Botão Confirmar não encontrado. Fallback p/ blur...');
                            await page.keyboard.press('Tab');
                            await page.waitForTimeout(6000);
                        }
                    }
                } catch (e) {
                    console.error('[C6Adapter] ⚠️ Failed to apply Dealer Return configurations:', e);
                }
            }

            // Try to extract offers from the UI
            console.log('[C6Adapter] 📊 Scraping offers...');

            // Adicional: aguardar 5 segundos garantindo que todos os cálculos e animações terminem
            await page.waitForTimeout(5000);

            // BEFORE extracting offers, MINIMUM DOWNPAYMENT HAS BEEN MOVED DOWN


            const offersData = await page.evaluate(() => {
                const offers: any[] = [];

                // O C6 Bank injeta os botões de simulação dentro de:
                // <button class="... parcela-button ..."> <span class="parcela-valor"> {Meses}x <span class="parcela-valor"> de R$ {Valor}</span></span></button>
                const buttons = document.querySelectorAll('button.parcela-button');

                buttons.forEach(btn => {
                    const text = (btn as HTMLElement).innerText || '';

                    // Exemplo de text recebido: "48x de R$ 988,00" ou "60x" (desabilitado/sem valor)
                    const m = text.match(/(\d+)\s*[xX]\s*(?:de\s*)?R\$\s*([\d.,]+)/i);
                    if (m) {
                        const installments = parseInt(m[1], 10);
                        const valueStr = m[2].replace(/\./g, '').replace(',', '.');
                        const value = parseFloat(valueStr);

                        if (installments > 0 && value > 0) {
                            offers.push({
                                installments,
                                monthlyPayment: value,
                                interestRate: 0 // Valor default assumido caso a API n retorne
                            });
                        }
                    }
                });

                // Deduping
                const unique = new Map<number, any>();
                offers.forEach(o => unique.set(o.installments, o));
                return Array.from(unique.values()).sort((a, b) => a.installments - b.installments);
            });

            console.log(`[C6Adapter] Found ${offersData.length} offers:`, offersData);

            if (offersData.length > 0) {
                result.offers = offersData.map((o: any) => ({
                    bankId: this.id,
                    installments: o.installments,
                    monthlyPayment: o.monthlyPayment,
                    totalValue: o.installments * o.monthlyPayment,
                    interestRate: o.interestRate,
                    description: `${o.installments}x R$ ${o.monthlyPayment.toFixed(2)}`,
                    hasHighChance: false,
                } as SimulationOffer));

                result.status = 'SUCCESS';
                console.log(`[C6Adapter] ✅ ${result.offers.length} offers scraped!`);
            } else {
                console.warn('[C6Adapter] ⚠️ No offers found.');

                // DEBUG: Print page content nicely to terminal when 0 offers happen
                const pageText = await page.locator('body').innerText();
                console.log('--- C6 PAGE DUMP (FIRST 1500 CHARS) ---');
                console.log(pageText.substring(0, 1500));
                console.log('---------------------------------------');

                result.message = 'Cliente não aprovado: Não temos condições aprováveis para este cliente.';
            }

            // Apos extrair as ofertas, checamos o valor mínimo de entrada na tela nova
            let extractedMinDownPayment: number | undefined;

            try {
                console.log('[C6Adapter] 💰 Checking minimum down payment recommended...');
                // 1. Click the recommended minimum dot
                const minMarker = page.locator('circle.marker.min-marker').first();
                if (await minMarker.isVisible({ timeout: 3000 })) {
                    await minMarker.click({ force: true });
                    console.log('[C6Adapter] ⏳ Waiting for recalculation after clicking min-marker...');
                    await page.waitForTimeout(5000); // aguarda atualizar a pagina/span

                    // 2. Read the value from the span.resumo-description
                    // O valor minimo vai aparecer no resumo-description: "R$ 31.219,86"
                    const valStrs = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll('span.resumo-description'))
                            .map(el => el.textContent?.trim() || '')
                            .filter(t => t.includes('R$'));
                    });

                    console.log(`[C6Adapter] Vals in resumo-description:`, valStrs);

                    // Vamos procurar pelo valor que corresponda à "Entrada" (frequentemente e o segundo item na barra de resumo: Carro, Entrada, Financiado)
                    // Mas na duvida, ou pegamos o valor da div q tem "Entrada"
                    const minDPEntrada = await page.evaluate(() => {
                        const allDivs = document.querySelectorAll('div');
                        for (const div of Array.from(allDivs)) {
                            // Procura o titulo "Entrada"
                            if (div.textContent?.trim().toLowerCase() === 'entrada' || div.querySelector('.resumo-title')?.textContent?.trim().toLowerCase() === 'entrada') {
                                const desc = div.parentElement?.querySelector('.resumo-description');
                                if (desc && desc.textContent?.includes('R$')) return desc.textContent.trim();
                            }
                        }
                        
                        // Fallback: tentar pegar o element que esta do lado da label 'Entrada'
                        const allSpans = document.querySelectorAll('span.resumo-description');
                        for (const span of Array.from(allSpans)) {
                            const parentText = span.parentElement?.textContent?.toLowerCase() || '';
                            if (parentText.includes('entrada')) {
                                return span.textContent?.trim();
                            }
                        }

                        // Se nao achar pelo texto 'entrada', retorna o input original atualizado ou o ultimo span de R$ q faca sentido
                        console.log("Fallback para #entrada ou segunda posicao");
                        const inputEntrada = document.querySelector('#entrada') as HTMLInputElement;
                        if (inputEntrada && inputEntrada.value) {
                            return inputEntrada.value;
                        }
                        return null;
                    });

                    const finalStrChoice = minDPEntrada || valStrs[1] || valStrs[0]; // fallback heuristico
                    console.log(`[C6Adapter] Chosen value string for minimum down payment: ${finalStrChoice}`);

                    if (finalStrChoice) {
                        const numericStr = finalStrChoice.replace(/[^\d,-]/g, '').replace(',', '.');
                        extractedMinDownPayment = parseFloat(numericStr);
                        if (extractedMinDownPayment >= 0) {
                            console.log(`[C6Adapter] Minimum recommended down payment calculated: R$ ${extractedMinDownPayment}`);
                            result.minDownPayment = extractedMinDownPayment;
                            
                            if (result.offers && result.offers.length > 0) {
                                result.offers.forEach(o => {
                                    (o as any).minDownPayment = extractedMinDownPayment;
                                });
                            }
                        }
                    }
                    
                    // Nao precisamos mais re-inserir o downPayment (a avaliacao/ofertas ja foi extraida)
                }
            } catch (e) {
                console.log('[C6Adapter] ⚠️ Could not extract minimum down payment:', e);
            }

            return result;

        } catch (error: any) {
            console.error('[C6Adapter] Simulation error:', error.message);
            result.message = error.message;
            return result;
        }
    }

    /** Helper for masked money inputs */
    private async fillMoneyField(page: Page, selector: string, value: number): Promise<void> {
        const field = page.locator(selector);
        await field.waitFor({ state: 'visible', timeout: 5000 });
        await field.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        // Type the raw cents amount because masks usually shift decimals
        await page.keyboard.type(Math.round(value * 100).toString(), { delay: 30 });
        await page.waitForTimeout(500);
    }
}
