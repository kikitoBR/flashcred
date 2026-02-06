import { chromium } from 'playwright';
import path from 'path';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const htmlPath = path.join(__dirname, '../../storage/debug/itau_dashboard.html');

    // Convert to file URL
    const fileUrl = `file://${htmlPath.replace(/\\/g, '/')}`;
    console.log(`Loading ${fileUrl}...`);

    await page.goto(fileUrl);

    const buttons = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('button, a, div[role="button"], span, li'));
        return els.map(el => ({
            tag: el.tagName,
            text: (el as HTMLElement).innerText ? (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim() : '',
            class: el.className,
            id: el.id
        })).filter(item => item.text.length > 3);
    });

    console.log('--- INTERACTIVE ELEMENTS ---');
    buttons.forEach((btn, i) => {
        if (btn.text.match(/simul|nova|proposta|veículo/i)) {
            console.log(`${i}: [${btn.tag}] "${btn.text}" - Class: ${btn.class} - ID: ${btn.id}`);
        }
    });

    await browser.close();
})();
