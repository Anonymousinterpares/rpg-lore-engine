/**
 * One-time migration script: Convert legacy skillProficiencies[] to new skills Record.
 * Run: npx tsx cli/scripts/migrate_skills.ts
 *
 * For each save file:
 * - Reads character.skillProficiencies (string array)
 * - Creates character.skills Record with Tier 1 for each proficiency
 * - Initializes character.skillPoints { available: 0, totalEarned: 0 }
 * - Preserves all other data unchanged
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAVES_DIR = path.join(__dirname, '..', '..', 'saves');

function migrateSave(filePath: string): boolean {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);

        const char = data.character;
        if (!char) return false;

        // Already migrated — but check if baseTier is missing (added in later patch)
        if (char.skills && Object.keys(char.skills).length > 0) {
            let patched = false;
            for (const [name, skill] of Object.entries(char.skills) as [string, any][]) {
                if (skill.baseTier === undefined) {
                    skill.baseTier = skill.pointsInvested === 0 ? skill.tier : (skill.tier > 0 ? 1 : 0);
                    patched = true;
                }
            }
            // Patch all missing Phase 10+ fields
            if (char.darkvision === undefined) {
                const racesWithDarkvision = ['Elf', 'High_Elf', 'High Elf', 'Dwarf', 'Hill_Dwarf', 'Hill Dwarf', 'Gnome', 'Rock_Gnome', 'Rock Gnome', 'Half-Elf', 'Half-Orc', 'Tiefling'];
                char.darkvision = racesWithDarkvision.some(r => char.race?.includes(r)) ? 60 : 0;
                patched = true;
            }
            if (char.multiclassLevels === undefined) {
                char.multiclassLevels = {};
                patched = true;
            }
            if (data._examineCooldowns === undefined) {
                data._examineCooldowns = { examine_attempts: [] };
                patched = true;
            }
            if (data._pendingASI === undefined) {
                data._pendingASI = 0;
                patched = true;
            }
            if (data._abilityUses === undefined) {
                data._abilityUses = {};
                patched = true;
            }

            if (patched) {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
                console.log(`  [PATCH] ${filePath} — patched (baseTier/darkvision)`);
                return true;
            }
            console.log(`  [SKIP] ${filePath} — already up to date`);
            return false;
        }

        // Migrate skillProficiencies → skills Record
        const proficiencies: string[] = char.skillProficiencies || [];
        const skills: Record<string, any> = {};
        for (const skillName of proficiencies) {
            skills[skillName] = {
                tier: 1,
                baseTier: 1,
                pointsInvested: 0,
                chosenAbility: {}
            };
        }
        char.skills = skills;

        // Initialize skillPoints based on level (retroactive: 2 SP per level above 1)
        const level = char.level || 1;
        const retroactiveSP = Math.max(0, (level - 1) * 2);
        char.skillPoints = {
            available: retroactiveSP,
            totalEarned: retroactiveSP
        };

        // Write back
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`  [OK] ${filePath} — migrated ${proficiencies.length} skills, granted ${retroactiveSP} retroactive SP`);
        return true;
    } catch (e) {
        console.error(`  [ERR] ${filePath}:`, e);
        return false;
    }
}

function findSaveFiles(dir: string): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findSaveFiles(full));
        } else if (entry.name.endsWith('.json') && !entry.name.includes('registry')) {
            files.push(full);
        }
    }
    return files;
}

function main() {
    console.log('=== Skill System Migration ===\n');
    const files = findSaveFiles(SAVES_DIR);
    console.log(`Found ${files.length} save file(s) in ${SAVES_DIR}\n`);

    let migrated = 0;
    for (const f of files) {
        if (migrateSave(f)) migrated++;
    }

    console.log(`\nDone. Migrated: ${migrated}, Skipped: ${files.length - migrated}`);
}

main();
