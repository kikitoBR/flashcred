import axios from 'axios';
import { query } from '../database';

const API_BASE_URL = 'https://parallelum.com.br/fipe/api/v1';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function seedFipe() {
    console.log('Starting FIPE Database Seeding...');

    try {
        // Step 1: Fetch and Insert Brands
        console.log(`Fetching Car Brands...`);
        const { data: brands } = await axios.get(`${API_BASE_URL}/carros/marcas`);

        console.log(`Found ${brands.length} brands. Inserting...`);
        for (const brand of brands) {
            await query(
                `INSERT INTO fipe_brands (id, name, vehicle_type) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                [brand.codigo, brand.nome, 'carros']
            );
        }

        // Warning: Fetching everything might take a long time and trigger rate limits. 
        // For MVPs, it's safer to only seed top brands or let the user fetch later over time.
        // We'll prompt the user after fetching brands to see if they want a full or partial seed.
        console.log('\n--- BRANDS SEED COMPLETED ---');
        console.log('To avoid hitting API rate limits (Parallelum blocks after too many fast requests),');
        console.log('we have stopped at Brands. From here, your UI could fetch Models and Versions dynamically');
        console.log('from the official API, and cache them as needed, OR we can build a crawler here.');
        console.log('\nBut wait! There is a faster way: we can pre-seed only the most popular 5 brands right now!');

        const popularBrandIds = [59, 21, 22, 23, 56]; // VW, Fiat, Ford, GM, Toyota (approximated IDs)

        for (const bId of popularBrandIds) {
            try {
                const brandDb: any = await query(`SELECT name FROM fipe_brands WHERE id = ?`, [bId]);
                const brandName = brandDb[0]?.name || bId;

                console.log(`\nFetching Models for Brand ${brandName} (${bId})...`);
                const { data: modelsData } = await axios.get(`${API_BASE_URL}/carros/marcas/${bId}/modelos`);

                for (const model of modelsData.modelos) {
                    await query(
                        `INSERT INTO fipe_models (id, brand_id, name) VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                        [model.codigo, bId, model.nome]
                    );
                }

                // Just fetch years for the first model of this brand as a proof-of-concept
                // A full DB crawler requires dedicated timeout limits and proxy rotation.
                const firstModel = modelsData.modelos[0];
                if (firstModel) {
                    console.log(`  --> Fetching Years for Model ${firstModel.nome}...`);
                    const { data: yearsData } = await axios.get(`${API_BASE_URL}/carros/marcas/${bId}/modelos/${firstModel.codigo}/anos`);

                    for (const year of yearsData) {
                        // year.codigo looks like "2015-1"
                        const yearParts = year.nome.split(' '); // e.g. "2015 Gasolina"
                        const yearNum = parseInt(yearParts[0]) || 0;

                        await query(
                            `INSERT INTO fipe_years (id, model_id, name, year) VALUES (?, ?, ?, ?)
                              ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                            [year.codigo, firstModel.codigo, year.nome, yearNum]
                        );
                    }
                }

                await delay(1000); // 1 second delay to respect rate limits

            } catch (err: any) {
                console.warn(`Failed to fetch deeper data for brand ${bId}:`, err.message);
            }
        }

        console.log('\n--- SEEDING FINISHED ---');
        console.log('A robust production local DB usually requires downloading a pre-compiled JSON dump.');
        console.log('For our FlashCred MVP, we will make the UI fetch dynamically from the API and save in DB.');

    } catch (e: any) {
        console.error('Fatal Seeding Error:', e.message);
    }

    process.exit(0);
}

seedFipe();
