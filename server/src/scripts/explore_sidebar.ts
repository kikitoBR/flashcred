import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const storageDir = path.join(__dirname, '../../storage/debug');
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    try {
        console.log('Navigating to Main Site...');
        await page.goto('https://www.credlineitau.com.br/', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000);

        // Check for login iframe
        console.log('Looking for login iframe...');
        const frameElement = await page.waitForSelector('iframe[src*="accounts-vehicle.itau.com.br"]', { timeout: 20000 }).catch(() => null);

        if (frameElement) {
            console.log('Login iframe found. Filling credentials...');
            const frame = await frameElement.contentFrame();

            if (process.env.ITAU_LOGIN && process.env.ITAU_PASSWORD && frame) {
                await frame.waitForSelector('#username', { state: 'visible' });
                await frame.fill('#username', process.env.ITAU_LOGIN);
                await frame.fill('#password', process.env.ITAU_PASSWORD);
                await frame.click('#kc-login');

                console.log('Login submitted. Waiting for dashboard...');
                await page.waitForTimeout(15000);
                await page.waitForLoadState('networkidle');
            }
        } else {
            console.log('No login iframe found. Maybe already logged in?');
        }

        // Take screenshot of dashboard
        await page.screenshot({ path: path.join(storageDir, 'nav_step1_dashboard.png'), fullPage: true });
        console.log('Dashboard screenshot taken.');

        // Hover over sidenav to expand it
        console.log('Hovering over sidenav to expand...');
        const sidenav = await page.locator('.sidenav').first();
        await sidenav.hover();
        await page.waitForTimeout(1500); // Wait for expansion animation

        // Screenshot with expanded sidenav
        await page.screenshot({ path: path.join(storageDir, 'nav_step2_sidebar_expanded.png'), fullPage: true });
        console.log('Expanded sidebar screenshot taken.');

        // Get all icons and their text labels
        const sidebarInfo = await page.evaluate(() => {
            const items = document.querySelectorAll('.sidenav-item-content button, .sidenav-item-description');
            return Array.from(items).map((el, idx) => {
                const icon = el.querySelector('.ids-icon');
                const textEl = el.querySelector('.shortcut-title') || el;
                return {
                    index: idx,
                    text: (textEl as HTMLElement).innerText?.trim() || '',
                    iconClass: icon?.className || '',
                    ariaLabel: el.getAttribute('aria-label') || ''
                };
            });
        });
        console.log('Sidebar items found:', JSON.stringify(sidebarInfo, null, 2));

        // Click on the CPF search bar and type a CPF to start a new simulation
        // This might be how you initiate a new proposal
        console.log('Trying to search for a CPF to start new simulation...');
        const searchInput = await page.locator('input[placeholder*="cpf"]').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('12345678900'); // Dummy CPF
            await page.waitForTimeout(1000);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(storageDir, 'nav_step3_after_search.png'), fullPage: true });
            console.log('Screenshot after CPF search.');
        }

        // Try clicking on the different sidebar icons
        // First icon (home) is at index 0, second might be "propostas" or "simulação"
        const iconsToTry = await page.locator('.sidenav-item-content').all();
        console.log(`Found ${iconsToTry.length} sidebar icons.`);

        for (let i = 1; i < Math.min(iconsToTry.length, 5); i++) { // Skip home (0), try up to 4 more
            console.log(`Clicking sidebar icon ${i}...`);
            await iconsToTry[i].click();
            await page.waitForTimeout(3000);
            await page.waitForLoadState('networkidle').catch(() => { });

            // Take screenshot
            await page.screenshot({ path: path.join(storageDir, `nav_step_sidebar_${i}.png`), fullPage: true });
            console.log(`Screenshot after clicking icon ${i}.`);

            // Save HTML for analysis
            const html = await page.content();
            fs.writeFileSync(path.join(storageDir, `nav_step_sidebar_${i}.html`), html);
        }

        console.log('\n=== NAVIGATION EXPLORATION COMPLETE ===');
        console.log('Check the storage/debug folder for screenshots.');

    } catch (error) {
        console.error('Exploration failed:', error);
        await page.screenshot({ path: path.join(storageDir, 'nav_error.png') });
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }
})();
