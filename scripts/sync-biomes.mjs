import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.resolve(__dirname, '../public/assets/biomes');
const MANIFEST_PATH = path.resolve(__dirname, '../src/ruleset/data/biome-manifest.json');

console.log('🔍 Scanning biomes in:', ASSETS_DIR);

function discoverBiomes() {
    if (!fs.existsSync(ASSETS_DIR)) {
        console.error('❌ Biomes directory not found!');
        return;
    }

    const files = fs.readdirSync(ASSETS_DIR);
    const manifest = {
        variants: {},
        lastUpdated: new Date().toISOString()
    };

    files.forEach(file => {
        if (!file.endsWith('.png')) return;

        // Match [biome]_[variant].png
        const match = file.match(/^(.+)_(\d+)\.png$/);
        if (match) {
            const biome = match[1]; // e.g. "desert"
            const variant = parseInt(match[2], 10);

            // Normalize biome name to TitleCase to match BiomeType (e.g. "desert" -> "Desert")
            const normalizedBiome = biome.charAt(0).toUpperCase() + biome.slice(1);

            if (!manifest.variants[normalizedBiome]) {
                manifest.variants[normalizedBiome] = 0;
            }

            // Keep track of the highest variant number (or just count them)
            // Using max variant number as the "count" is safer if files are missing in between
            manifest.variants[normalizedBiome] = Math.max(manifest.variants[normalizedBiome], variant);
        }
    });

    // Ensure all known biomes are present even with 0 variants
    const ALL_BIOMES = [
        'Plains', 'Forest', 'Hills', 'Mountains', 'Swamp',
        'Desert', 'Tundra', 'Jungle', 'Coast', 'Ocean',
        'Volcanic', 'Ruins', 'Farmland', 'Urban'
    ];

    ALL_BIOMES.forEach(b => {
        if (!manifest.variants[b]) manifest.variants[b] = 0;
    });

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log('✅ Biome manifest updated at:', MANIFEST_PATH);
}

discoverBiomes();
