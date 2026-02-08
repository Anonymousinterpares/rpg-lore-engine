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

    // Ensure all known biomes are initialized with empty arrays
    const ALL_BIOMES = [
        'Plains', 'Forest', 'Hills', 'Mountains', 'Swamp',
        'Desert', 'Tundra', 'Jungle', 'Coast', 'Ocean',
        'Volcanic', 'Ruins', 'Farmland', 'Urban'
    ];

    ALL_BIOMES.forEach(b => {
        manifest.variants[b] = [];
    });

    files.forEach(file => {
        if (!file.endsWith('.png')) return;

        // Match [biome]_[variant].png
        const match = file.match(/^(.+)_(\d+)\.png$/);
        if (match) {
            const biome = match[1]; // e.g. "desert"
            const variant = parseInt(match[2], 10);

            // Normalize biome name to TitleCase to match BiomeType (e.g. "desert" -> "Desert")
            const normalizedBiome = biome.charAt(0).toUpperCase() + biome.slice(1);

            // Add variant if it belongs to a known biome
            if (manifest.variants[normalizedBiome] && !manifest.variants[normalizedBiome].includes(variant)) {
                manifest.variants[normalizedBiome].push(variant);
            }
        }
    });

    // Sort variants for logic consistency
    Object.keys(manifest.variants).forEach(key => {
        manifest.variants[key].sort((a, b) => a - b);
    });

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log('✅ Biome manifest updated at:', MANIFEST_PATH);
}

discoverBiomes();
