import * as fs from 'fs';
import * as path from 'path';
import { RulebookRegistry } from '../schemas/Registry';
/**
 * The Validation Engine.
 * This script scans the data directory and ensures everything matches the Zod schemas.
 */
const DATA_DIR = path.resolve(process.cwd(), 'data');
function validateAll() {
    console.log('--- Starting RPG Lore Validation ---');
    console.log(`[DEBUG] Looking for data in: ${DATA_DIR}`);
    try {
        if (!fs.existsSync(DATA_DIR)) {
            console.warn(`Data directory not found at ${DATA_DIR}. Create it to start adding content.`);
            return;
        }
        const subDirs = fs.readdirSync(DATA_DIR);
        console.log(`[DEBUG] Found directories: ${subDirs.join(', ')}`);
        let errorCount = 0;
        subDirs.forEach(dir => {
            const schemaName = dir.toLowerCase();
            const schema = RulebookRegistry[schemaName];
            if (!schema) {
                console.warn(`[SKIP] No schema found for directory: ${dir}`);
                return;
            }
            const dirPath = path.join(DATA_DIR, dir);
            if (!fs.statSync(dirPath).isDirectory())
                return;
            const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
            files.forEach(file => {
                const filePath = path.join(dirPath, file);
                const rawData = fs.readFileSync(filePath, 'utf-8');
                try {
                    const json = JSON.parse(rawData);
                    const result = schema.safeParse(json);
                    if (!result.success) {
                        console.error(`[ERROR] Validation failed for ${dir}/${file}:`);
                        result.error.errors.forEach(err => {
                            console.error(`  - ${err.path.join('.')}: ${err.message}`);
                        });
                        errorCount++;
                    }
                    else {
                        console.log(`[OK] ${dir}/${file}`);
                    }
                }
                catch (e) {
                    console.error(`[ERROR] Failed to parse JSON in ${dir}/${file}`);
                    errorCount++;
                }
            });
        });
        if (errorCount === 0) {
            console.log('\n--- Validation Successful (0 Errors) ---');
        }
        else {
            console.error(`\n--- Validation Failed (${errorCount} Errors) ---`);
            process.exit(1);
        }
    }
    catch (globalError) {
        console.error(`[CRITICAL] Unexpected error during validation: ${globalError.message}`);
        console.error(globalError.stack);
        process.exit(1);
    }
}
validateAll();
