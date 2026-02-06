import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    const storageDir = path.join(__dirname, '../../storage/debug');
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    console.log('Launching browser...');
    console.log('Launching browser...');
    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized']
    });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

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
        await page.screenshot({ path: path.join(storageDir, 'step1_dashboard.png') });
        console.log('Dashboard screenshot taken.');

        // Now, let's explore the sidebar icons
        // The sidebar icons are in a sidenav element
        // Looking for the second icon that might be "nova proposta" or simulation
        console.log('Looking for sidebar navigation items...');

        // Get all sidebar buttons/links
        const sidebarItems = await page.locator('.sidenav button, .sidenav a, .sidenav-item-content').all();
        console.log(`Found ${sidebarItems.length} sidebar items.`);

        // Let's try clicking the second icon in sidebar (likely "Nova Proposta")
        // First, let's see what elements are in the sidebar
        const sidenavIcons = await page.evaluate(() => {
            const sidenav = document.querySelector('.sidenav');
            if (!sidenav) return [];
            const items = Array.from(sidenav.querySelectorAll('button, a'));
            return items.map((el, i) => ({
                index: i,
                tag: el.tagName,
                text: (el as HTMLElement).innerText?.trim() || '',
                className: el.className,
                ariaLabel: el.getAttribute('aria-label') || '',
                title: el.getAttribute('title') || ''
            }));
        });
        console.log('Sidebar elements:', JSON.stringify(sidenavIcons, null, 2));

        // Look for "Nova Proposta" or similar text
        const newProposalBtn = await page.waitForSelector('text=nova proposta', { timeout: 5000 }).catch(() => null);
        const simulacaoBtn = await page.waitForSelector('text=simula', { timeout: 5000 }).catch(() => null);

        // Try clicking the second sidebar button (likely simulation/new proposal)
        // Based on the screenshot, it's likely the icon that looks like a chain/link
        const secondSidebarItem = await page.locator('.sidenav-item-content').nth(1);
        if (await secondSidebarItem.isVisible()) {
            console.log('Clicking second sidebar item...');
            await secondSidebarItem.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(storageDir, 'step2_after_click_sidebar_2.png') });
            console.log('Screenshot after clicking sidebar item 2.');
        }

        // Let's also try to get text/tooltip of sidebar icons
        const sidebarTexts = await page.evaluate(() => {
            const spans = document.querySelectorAll('.sidenav-item-description, .shortcut-title');
            return Array.from(spans).map(s => (s as HTMLElement).innerText?.trim());
        });
        console.log('Sidebar texts:', sidebarTexts);

        // Go back and try the third icon
        await page.locator('.sidenav-item-content').first().click(); // Go home
        await page.waitForTimeout(2000);

        const thirdSidebarItem = await page.locator('.sidenav-item-content').nth(2);
        if (await thirdSidebarItem.isVisible()) {
            console.log('Clicking third sidebar item...');
            await thirdSidebarItem.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: path.join(storageDir, 'step3_after_click_sidebar_3.png') });
            console.log('Screenshot after clicking sidebar item 3.');
        }

        // Save HTML of current page
        const currentHtml = await page.content();
        fs.writeFileSync(path.join(storageDir, 'exploration_result.html'), currentHtml);
        console.log('Saved exploration result HTML.');

        console.log('\n=== EXPLORATION COMPLETE ===');
        console.log('Check the following files:');
        console.log('- step1_dashboard.png');
        console.log('- step2_after_click_sidebar_2.png');
        console.log('- step3_after_click_sidebar_3.png');
        console.log('- exploration_result.html');

    } catch (error) {
        console.error('Exploration failed:', error);
        await page.screenshot({ path: path.join(storageDir, 'exploration_error.png') });
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }
})();
