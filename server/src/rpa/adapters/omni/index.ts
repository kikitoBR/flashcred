import { Page } from 'playwright';
import { BankAdapter, Credential, SimulationInput, SimulationResult, SimulationOffer } from '../../types';

export class OmniAdapter implements BankAdapter {
    id = 'omni';
    name = 'Omni Financeira';
    private baseUrl = 'https://omni-mais.omni.com.br/login';

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

            // Usuário — input com label "Usuário"
            const usernameField = page.locator('input.omni-input[formcontrolname="username"]');
            await usernameField.waitFor({ state: 'visible', timeout: 15000 });
            await usernameField.click();
            await usernameField.fill('');
            await page.keyboard.type(credentials.login, { delay: 40 });

            // Senha — input type password com label "Senha de acesso"
            const passwordField = page.locator('input.omni-input[formcontrolname="password"]');
            await passwordField.waitFor({ state: 'visible', timeout: 5000 });
            await passwordField.click();
            await passwordField.fill('');
            await page.keyboard.type(credentials.password || '', { delay: 40 });
            await page.waitForTimeout(500);

            // Botão "Continuar"
            await this.clickOmniButton(page, 'Continuar');

            // Verifica credenciais inválidas
            const errorAlert = page.locator('.form-input_error-alert:has-text("Usuário ou senha")');
            const hasInvalidCreds = await errorAlert.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
            if (hasInvalidCreds) {
                console.error('[OmniAdapter] ❌ Login failed — Usuário e/ou senha inválido(s)');
                throw new Error('Usuário e/ou senha inválido(s)');
            }

            // Esperar redirecionamento (sair de /login)
            try {
                await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 25000 });
                console.log(`[OmniAdapter] ✅ Login OK → ${page.url()}`);
                return true;
            } catch {
                if (!page.url().includes('/login')) return true;
                console.error('[OmniAdapter] ❌ Login failed — still on /login');
                return false;
            }
        } catch (error: any) {
            console.error('[OmniAdapter] Login exception:', error.message);
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
        console.log(`[OmniAdapter] Simulation for CPF: ${input.client.cpf}`);
        const result: SimulationResult = { bankId: this.id, status: 'ERROR', offers: [] };

        try {
            // ── STEP 1: Clicar "Nova Simulação" ──
            console.log('[OmniAdapter] Step 1 → Nova Simulação...');
            const novaSimBtn = page.locator('button:has-text("Nova Simulação"), omni-button:has-text("Nova Simulação")').first();
            await novaSimBtn.waitFor({ state: 'visible', timeout: 15000 });
            await novaSimBtn.click();
            await page.waitForTimeout(2000);

            // ── STEP 2: Selecionar "Automóveis" ──
            console.log('[OmniAdapter] Step 2 → Automóveis...');
            const autoCard = page.locator('app-selectable-product-card:has-text("Automóveis"), button:has-text("Automóveis")').first();
            await autoCard.waitFor({ state: 'visible', timeout: 10000 });
            await autoCard.click();
            await page.waitForTimeout(1000);

            // ── STEP 3: Clicar "Continuar" no dialog de produto ──
            console.log('[OmniAdapter] Step 3 → Continuar (produto)...');
            await this.clickOmniButton(page, 'Continuar');
            await page.waitForTimeout(2000);

            // ── STEP 4: Inserir CPF do cliente ──
            console.log(`[OmniAdapter] Step 4 → CPF: ${input.client.cpf}`);
            const cpfInput = page.locator('input[placeholder*="CPF"], input.app-huge-input__input').first();
            await cpfInput.waitFor({ state: 'visible', timeout: 10000 });
            await cpfInput.click();
            await cpfInput.fill('');
            const cpfDigits = input.client.cpf.replace(/\D/g, '');
            await page.keyboard.type(cpfDigits, { delay: 50 });
            await page.waitForTimeout(1000);

            // Clicar Continuar (CPF)
            await this.clickOmniButton(page, 'Continuar');
            await page.waitForTimeout(2000);

            // ── STEP 5: Tratar modal "já possui proposta" ──
            console.log('[OmniAdapter] Step 5 → Verificando modal de proposta existente...');
            try {
                const novaSimModal = page.locator('button:has-text("Iniciar nova simulação"), span:has-text("Iniciar nova simulação")').first();
                if (await novaSimModal.isVisible({ timeout: 3000 })) {
                    console.log('[OmniAdapter] ⚠️ Modal de proposta existente detectado → clicando "Iniciar nova simulação"');
                    await novaSimModal.click();
                    await page.waitForTimeout(2000);
                }
            } catch {
                console.log('[OmniAdapter] ℹ️ Sem modal de proposta existente — cliente novo.');
            }

            // ── STEP 6: Espera inteligente — análise de perfil (~20s) ──
            console.log('[OmniAdapter] Step 6 → ⏳ Aguardando análise de perfil do cliente...');
            const profileAnalysisOk = await this.smartWait(page, [
                'input[testid="telephone-input"]',       // telefone = aprovado
                'input.telephone-page__input',            // telefone alternativo
                'app-denied-result-page',                 // negado
                '.denied-page__content'                   // novo fallback para negado
            ], 45000);

            // ── STEP 7: Detecção de negado ──
            if (page.url().includes('negado/resultado') || await page.locator('app-denied-result-page, .denied-page__content').isVisible({ timeout: 1000 }).catch(() => false)) {
                console.log('[OmniAdapter] ❌ Cliente NEGADO pelo banco Omni.');
                result.status = 'ERROR';
                result.message = 'Cliente não aprovado: Não temos condições aprováveis para este cliente.';
                return result;
            }

            if (!profileAnalysisOk) {
                console.warn('[OmniAdapter] ⚠️ Timeout na análise de perfil. Verificando estado da página...');
                // Última tentativa de check
                if (page.url().includes('negado')) {
                    result.message = 'Cliente não aprovado: Não temos condições aprováveis para este cliente.';
                    return result;
                }
            }

            // ── STEP 8: Inserir telefone do cliente ──
            console.log(`[OmniAdapter] Step 8 → Telefone: ${input.client.phone || '11999999999'}`);
            const phoneInput = page.locator('input[testid="telephone-input"], input.telephone-page__input').first();
            await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
            await phoneInput.click();
            await phoneInput.fill('');
            const phoneDigits = (input.client.phone || '11999999999').replace(/\D/g, '');
            await page.keyboard.type(phoneDigits, { delay: 40 });
            await page.waitForTimeout(500);

            // Continuar (telefone)
            await this.clickOmniButton(page, 'Continuar');
            await page.waitForTimeout(2000);

            // ── STEP 9: Inserir Placa e UF de licenciamento ──
            console.log(`[OmniAdapter] Step 9 → Placa: ${input.vehicle.plate} | UF: ${input.vehicle.uf}`);

            // Placa
            const plateInput = page.locator('input[testid="vehicle-plate"], input[formcontrolname="plate"]').first();
            await plateInput.waitFor({ state: 'visible', timeout: 10000 });
            await plateInput.click();
            await plateInput.fill('');
            await page.keyboard.type(input.vehicle.plate.replace(/\s/g, ''), { delay: 50 });
            await page.waitForTimeout(1000);

            // UF de licenciamento — omni-select customizado (readonly input + overlay)
            console.log(`[OmniAdapter] → Selecionando UF: ${input.vehicle.uf}`);
            const ufSelect = page.locator('omni-select[testid="vehicle-licensing-state"], omni-select[formcontrolname="licensingState"]').first();
            await ufSelect.waitFor({ state: 'visible', timeout: 10000 });
            await ufSelect.locator('input.omni-input').click({ force: true }); // Abre o overlay
            await page.waitForTimeout(1500);

            // A UF no omni é exibida como "RJ (Rio de Janeiro)"
            // Então vamos digitar no input e clicar na opção correspondente do overlay
            console.log(`[OmniAdapter] Localizando UF no overlay...`);
            await page.keyboard.type(input.vehicle.uf, { delay: 100 });
            await page.waitForTimeout(1500); // Espera o search processar

            // Procurar na lista (o overlay do omni-select CDK)
            // Usa regex case-insensitive para suportar "RJ (Rio de..." e pega o primeiro botão/div da lista
            const ufOption = page.locator('.cdk-overlay-container').locator(`text=/${input.vehicle.uf}/i`).first();

            if (await ufOption.isVisible({ timeout: 5000 }).catch(() => false)) {
                await ufOption.click({ force: true });
                console.log(`[OmniAdapter] Opção UF clicada com sucesso!`);
            } else {
                console.log(`[OmniAdapter] Fallback: Tentando ArrowDown + Enter (opção não visível no DOM)`);
                // Como digitamos a UF, a primeira opção geralmente é a certa. ArrowDown + Enter seleciona nativamente.
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(500);
                await page.keyboard.press('Enter');
            }
            await page.waitForTimeout(1000);

            // Continuar (placa+uf)
            await this.clickOmniButton(page, 'Continuar');

            // ── STEP 10: Espera inteligente — análise pós-veículo (~10s) ──
            console.log('[OmniAdapter] Step 10 → ⏳ Aguardando análise do veículo...');
            await this.smartWait(page, [
                'input[testid="vehicle-value-input"]',    // campo de valor = seguiu
                'app-denied-result-page',                 // negado
                '.denied-page__content'                   // novo fallback para negado
            ], 30000);

            // Check negação novamente
            if (page.url().includes('negado/resultado') || await page.locator('app-denied-result-page, .denied-page__content').isVisible({ timeout: 1000 }).catch(() => false)) {
                console.log('[OmniAdapter] ❌ Cliente NEGADO após análise de veículo.');
                result.status = 'ERROR';
                result.message = 'Cliente não aprovado: Não temos condições aprováveis para este cliente.';
                return result;
            }

            // ── STEP 11: Valor do veículo ──
            console.log(`[OmniAdapter] Step 11 → Valor do veículo: R$ ${input.vehicle.price}`);
            const vehicleValueInput = page.locator('input[testid="vehicle-value-input"], input[formcontrolname="vehicleValue"]').first();
            await vehicleValueInput.waitFor({ state: 'visible', timeout: 10000 });
            await this.fillCurrencyInput(page, vehicleValueInput, input.vehicle.price);

            // Continuar (valor veículo)
            await this.clickOmniButton(page, 'Continuar');
            await page.waitForTimeout(3000);

            // ── STEP 12: Valor da entrada ──
            const entryValue = input.downPayment || 0;
            console.log(`[OmniAdapter] Step 12 → Valor da entrada: R$ ${entryValue}`);
            const downPaymentInput = page.locator('input[testid="down-payment-input"], input[formcontrolname="downPayment"]').first();
            await downPaymentInput.waitFor({ state: 'visible', timeout: 10000 });

            // Raspar valor da entrada mínima exibida na tela
            let minDownPaymentValue: number | undefined;
            try {
                const entradaMinimaSpan = page.locator('span:has-text("Entrada mínima")').first();
                if (await entradaMinimaSpan.isVisible({ timeout: 3000 })) {
                    const spanText = await entradaMinimaSpan.innerText();
                    console.log(`[OmniAdapter] 📊 Texto entrada mínima: "${spanText}"`);
                    // Extrair valor numérico de "Entrada mínima: R$ 21.245,4"
                    const valueMatch = spanText.match(/R\$\s*[^\d]*([\d.,]+)/);
                    if (valueMatch) {
                        minDownPaymentValue = parseFloat(valueMatch[1].replace(/\./g, '').replace(',', '.'));
                        console.log(`[OmniAdapter] ✅ Entrada mínima: R$ ${minDownPaymentValue}`);
                    }
                }
            } catch {
                console.log('[OmniAdapter] ℹ️ Entrada mínima não encontrada na página.');
            }


            await this.fillCurrencyInput(page, downPaymentInput, entryValue);

            // Dar Enter para confirmar
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);

            // ── STEP 13: Configurar retorno do lojista (0-5 estrelas) ──
            const omniReturnVal = parseInt(input.options?.omniReturn || '0');
            console.log(`[OmniAdapter] Step 13 → Retorno lojista: ${omniReturnVal} estrela(s)`);

            if (omniReturnVal > 0) {
                try {
                    // Clicar no botão/dropdown de estrelas
                    const starButton = page.locator('button.installments__star-button, div.installments__dropdown-trigger').first();
                    if (await starButton.isVisible({ timeout: 5000 })) {
                        await starButton.click();
                        await page.waitForTimeout(1000);

                        // Selecionar o valor do dropdown (omni-dropdown)
                        const dropdownItem = page.locator(`omni-dropdown >> text="${omniReturnVal}"`).first();
                        if (await dropdownItem.isVisible({ timeout: 3000 }).catch(() => false)) {
                            await dropdownItem.click();
                        } else {
                            // Fallback: procurar por texto direto
                            const altItem = page.locator(`text="${omniReturnVal}"`).last();
                            await altItem.click();
                        }
                        await page.waitForTimeout(1500);
                        console.log(`[OmniAdapter] ✅ Retorno definido para ${omniReturnVal}`);
                    } else {
                        console.log('[OmniAdapter] ℹ️ Dropdown de estrelas não visível, mantendo valor padrão.');
                    }
                } catch (e: any) {
                    console.warn(`[OmniAdapter] ⚠️ Falha ao configurar retorno: ${e.message}`);
                }
            }

            // ── STEP 14: Esperar recálculo das parcelas ──
            console.log('[OmniAdapter] Step 14 → ⏳ Aguardando recálculo de parcelas...');
            await this.smartWait(page, [
                'app-select-installment-card',
                'div.card__content',
            ], 20000);
            // Pequena espera extra para estabilidade
            await page.waitForTimeout(2000);

            // ── STEP 15: Raspar parcelas ──
            console.log('[OmniAdapter] Step 15 → 📊 Raspando parcelas...');
            const offersData = await page.evaluate(() => {
                const offers: { installments: number; monthlyPayment: number }[] = [];

                // Estratégia 1: Buscar nos cards de parcela (app-select-installment-card)
                const cards = document.querySelectorAll('app-select-installment-card');
                cards.forEach(card => {
                    const text = (card as HTMLElement).innerText || '';
                    // Padrão: "60x de\nR$\u00a0872,23" ou "48x de R$ 966,26"
                    const match = text.match(/(\d+)x\s*de\s*(?:\n|\s)*R\$\s*[^\d]*([\d.,]+)/);
                    if (match) {
                        const installments = parseInt(match[1]);
                        const value = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
                        if (installments > 0 && value > 0) {
                            offers.push({ installments, monthlyPayment: value });
                        }
                    }
                });

                // Estratégia 2: Regex global se a primeira falhar
                if (offers.length === 0) {
                    const allText = document.body.innerText;
                    const regex = /(\d+)x\s*de\s*(?:\n|\s)*R\$\s*[^\d]*([\d.,]+)/g;
                    let match;
                    while ((match = regex.exec(allText)) !== null) {
                        const installments = parseInt(match[1]);
                        const value = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
                        if (installments > 0 && value > 0 && installments <= 120) {
                            offers.push({ installments, monthlyPayment: value });
                        }
                    }
                }

                // Deduplicar
                const unique = new Map<number, { installments: number; monthlyPayment: number }>();
                offers.forEach(o => unique.set(o.installments, o));
                return Array.from(unique.values()).sort((a, b) => a.installments - b.installments);
            });

            console.log(`[OmniAdapter] Found ${offersData.length} offers:`, offersData);

            // Mapear para SimulationOffer
            result.offers = offersData.map((o: any) => ({
                bankId: this.id,
                installments: o.installments,
                monthlyPayment: o.monthlyPayment,
                totalValue: o.installments * o.monthlyPayment,
                interestRate: 0,
                description: `${o.installments}x R$ ${o.monthlyPayment.toFixed(2)}`,
                hasHighChance: false,
                minDownPayment: minDownPaymentValue
            } as SimulationOffer));

            if (result.offers.length > 0) {
                result.status = 'SUCCESS';
                // Incluir entrada mínima no resultado
                if (minDownPaymentValue !== undefined) {
                    result.minDownPayment = minDownPaymentValue;
                }
                console.log(`[OmniAdapter] ✅ ${result.offers.length} parcelas extraídas!`);
            } else {
                console.warn('[OmniAdapter] ⚠️ Nenhuma parcela encontrada.');
                result.message = 'Cliente não aprovado: Não temos condições aprováveis para este cliente.';
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

    /** Clicar no omni-button pelo texto (novo sistema Angular) */
    private async clickOmniButton(page: Page, text: string): Promise<void> {
        try {
            // Tenta encontrar o botão visível com o texto correto
            const btn = page.locator(`omni-button:has-text("${text}") button, button:has(span.text-label:has-text("${text}"))`).first();
            await btn.waitFor({ state: 'visible', timeout: 8000 });
            await btn.click();
        } catch {
            // Fallback: qualquer botão contendo o texto
            console.warn(`[OmniAdapter] clickOmniButton fallback for "${text}"`);
            const fallback = page.locator(`button:has-text("${text}"):visible`).first();
            await fallback.click();
        }
    }

    /** Espera inteligente — aguarda qualquer um dos seletores aparecer */
    private async smartWait(page: Page, selectors: string[], timeout: number): Promise<boolean> {
        const startTime = Date.now();
        const pollInterval = 1000;

        while (Date.now() - startTime < timeout) {
            for (const selector of selectors) {
                try {
                    const el = page.locator(selector).first();
                    if (await el.isVisible({ timeout: 200 })) {
                        console.log(`[OmniAdapter] ✅ smartWait: "${selector}" visível após ${Date.now() - startTime}ms`);
                        return true;
                    }
                } catch { }
            }
            await page.waitForTimeout(pollInterval);
        }

        console.warn(`[OmniAdapter] ⚠️ smartWait: timeout de ${timeout}ms atingido sem encontrar nenhum seletor.`);
        return false;
    }

    /** Preencher input de moeda com máscara (currencymask) */
    private async fillCurrencyInput(page: Page, locator: any, value: number): Promise<void> {
        await locator.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        // Digitar o valor como centavos (mask de moeda espera isso)
        const cents = Math.round(value * 100).toString();
        await page.keyboard.type(cents, { delay: 30 });
        await page.keyboard.press('Tab');
        await page.waitForTimeout(1000);
    }
}
