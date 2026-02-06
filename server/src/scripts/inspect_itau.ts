import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        console.log('Navigating to Main Site...');
        await page.goto('https://www.credlineitau.com.br/', { waitUntil: 'networkidle', timeout: 60000 });

        await page.waitForTimeout(5000);

        const storageDir = path.join(__dirname, '../../storage/debug');

        // Check for login iframe
        console.log('Looking for login iframe...');
        const frameElement = await page.waitForSelector('iframe[src*="accounts-vehicle.itau.com.br"]', { timeout: 20000 }).catch(() => null);

        if (frameElement) {
            console.log('Login iframe found. filling credentials...');
            const frame = await frameElement.contentFrame();

            if (process.env.ITAU_LOGIN && process.env.ITAU_PASSWORD && frame) {
                await frame.waitForSelector('#username', { state: 'visible' });
                await frame.fill('#username', process.env.ITAU_LOGIN);
                await frame.fill('#password', process.env.ITAU_PASSWORD);
                await frame.click('#kc-login');

                console.log('Login submitted. Waiting for dashboard...');
                // Wait for the iframe to disappear or URL to change or a dashboard element to appear
                // Assuming the main page updates. Access control usually removes the iframe and shows the app.

                await page.waitForTimeout(15000); // Generous wait for SPA load
                await page.waitForLoadState('networkidle');

                console.log('Taking dashboard screenshot...');
                await page.screenshot({ path: path.join(storageDir, 'itau_dashboard.png') });

                const dashboardHtml = await page.content();
                fs.writeFileSync(path.join(storageDir, 'itau_dashboard.html'), dashboardHtml);

                // Look for navigation elements / Simulation button
                const navItems = await page.evaluate(() => {
                    const els = Array.from(document.querySelectorAll('a, button, li, span')); // Broad search
                    return els
                        .filter(el => (el as HTMLElement).innerText && (el as HTMLElement).innerText.length > 3)
                        .map(el => ({
                            tag: el.tagName,
                            text: (el as HTMLElement).innerText.trim(),
                            id: el.id,
                            class: el.className,
                            href: (el as HTMLAnchorElement).href
                        }));
                });

                // Filter relevant items to reduce log noise
                const relevantItems = navItems.filter(i =>
                    i.text.match(/simula|proposta|nova|veículo/i)
                );

                console.log('Possible Menu Items:', JSON.stringify(relevantItems, null, 2));

            }
        } else {
            console.log('No login iframe found. Maybe already logged in or different flow?');
            await page.screenshot({ path: path.join(storageDir, 'itau_no_iframe.png') });
        }

        await browser.close();
        console.log('Done.');
    } catch (e) {
        console.error('Error in inspection:', e);
    }
})();
