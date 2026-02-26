import { Router } from 'express';
import { query } from '../database';

const router = Router();
const API_BASE_URL = 'https://parallelum.com.br/fipe/api/v1';

// Native fetch helper to avoid needing axios
async function fetchJson(url: string) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'FlashCred-RPA-App/1.0',
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`FIPE API Error: ${response.statusText}`);
    }
    return response.json();
}

// ============================================================================
// GET /api/fipe/brands
// Fetches brands (caching them locally after first fetch)
// ============================================================================
router.get('/brands', async (req, res: any) => {
    try {
        // 1. Check local DB first
        const localBrands: any = await query(`SELECT id as codigo, name as nome FROM fipe_brands ORDER BY name ASC`);

        if (localBrands.length > 0) {
            return res.json(localBrands);
        }

        // 2. Fetch from External API if empty
        console.log('[FIPE] Fetching Brands from Remote API...');
        const data = await fetchJson(`${API_BASE_URL}/carros/marcas`);

        // 3. Save to local DB in background
        for (const brand of data) {
            await query(
                `INSERT INTO fipe_brands (id, name, vehicle_type) VALUES (?, ?, 'carros')
                 ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                [brand.codigo, brand.nome]
            ).catch(err => console.error('Failed to cache brand:', err.message));
        }

        return res.json(data);
    } catch (error) {
        console.error('[FIPE] Error fetching brands:', error);
        res.status(500).json({ error: 'Failed to fetch brands' });
    }
});

// ============================================================================
// GET /api/fipe/models/:brandId
// Fetches models for a specific brand
// ============================================================================
router.get('/models/:brandId', async (req, res: any) => {
    try {
        const { brandId } = req.params;

        const localModels: any = await query(`SELECT id as codigo, name as nome FROM fipe_models WHERE brand_id = ? ORDER BY name ASC`, [brandId]);

        if (localModels.length > 0) {
            return res.json({ modelos: localModels }); // Maintain the format of the external API
        }

        console.log(`[FIPE] Fetching Models for Brand ${brandId} from Remote API...`);
        const data = await fetchJson(`${API_BASE_URL}/carros/marcas/${brandId}/modelos`);

        if (data && data.modelos) {
            for (const model of data.modelos) {
                await query(
                    `INSERT INTO fipe_models (id, brand_id, name) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                    [model.codigo, brandId, model.nome]
                ).catch(err => console.error('Failed to cache model:', err.message));
            }
        }

        return res.json(data);
    } catch (error) {
        console.error('[FIPE] Error fetching models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

// ============================================================================
// GET /api/fipe/years/:brandId/:modelId
// Fetches years for a specific model
// ============================================================================
router.get('/years/:brandId/:modelId', async (req, res: any) => {
    try {
        const { brandId, modelId } = req.params;

        const localYears: any = await query(`SELECT id as codigo, name as nome FROM fipe_years WHERE model_id = ?`, [modelId]);

        if (localYears.length > 0) {
            return res.json(localYears);
        }

        console.log(`[FIPE] Fetching Years for Model ${modelId} from Remote API...`);
        const data = await fetchJson(`${API_BASE_URL}/carros/marcas/${brandId}/modelos/${modelId}/anos`);

        for (const year of data) {
            const yearParts = year.nome.split(' ');
            const yearNum = parseInt(yearParts[0]) || 0;

            await query(
                `INSERT INTO fipe_years (id, model_id, name, year) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                [year.codigo, modelId, year.nome, yearNum]
            ).catch(err => console.error('Failed to cache year:', err.message));
        }

        return res.json(data);
    } catch (error) {
        console.error('[FIPE] Error fetching years:', error);
        res.status(500).json({ error: 'Failed to fetch years' });
    }
});

// ============================================================================
// GET /api/fipe/versions/:brandId/:modelId/:yearId
// Final step: Get exactly the official FIPE string for this specific year/model
// ============================================================================
router.get('/versions/:brandId/:modelId/:yearId', async (req, res: any) => {
    try {
        const { brandId, modelId, yearId } = req.params;

        // This endpoint in the external API actually returns the single FIPE object for that exact combination.
        // E.g. {"Valor": "R$ 68.000,00", "Marca": "Fiat", "Modelo": "Cronos Drive", ...}
        // Since we want the user to click and save this specific version string, we proxy it exactly.

        const localVersion: any = await query(`SELECT price as Valor, name as Modelo, fipe_code as CodigoFipe, reference_month as MesReferencia FROM fipe_versions WHERE year_id = ? AND model_id = ?`, [yearId, modelId]);

        if (localVersion.length > 0) {
            return res.json(localVersion[0]);
        }

        console.log(`[FIPE] Fetching Version Details for ${brandId}/${modelId}/${yearId} from Remote API...`);
        const data = await fetchJson(`${API_BASE_URL}/carros/marcas/${brandId}/modelos/${modelId}/anos/${yearId}`);

        if (data.Modelo) {
            const versionId = `${modelId}_${yearId}`;
            await query(
                `INSERT INTO fipe_versions (id, model_id, year_id, fipe_code, name, price, reference_month) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price)`,
                [versionId, modelId, yearId, data.CodigoFipe, data.Modelo, data.Valor, data.MesReferencia]
            ).catch(err => console.error('Failed to cache version:', err.message));
        }

        return res.json(data);
    } catch (error: any) {
        // This is normal if the external API rate limited us or returned 404
        console.error(`[FIPE] Error fetching FIPE details for ${req.params.yearId}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch specific FIPE version details' });
    }
});

export default router;
