/**
 * Character Creation CLI — Interactive terminal wizard
 *
 * Run: npx tsx cli/creation.ts
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { bootstrapCLI } from './bootstrap';
import { DataManager } from '../src/ruleset/data/DataManager';
import { CharacterFactory, CharacterCreationOptions } from '../src/ruleset/factories/CharacterFactory';
import { GameStateManager } from '../src/ruleset/combat/GameStateManager';
import { FileStorageProvider } from '../src/ruleset/combat/FileStorageProvider';
import { Race } from '../src/ruleset/schemas/RaceSchema';
import { CharacterClass } from '../src/ruleset/schemas/ClassSchema';
import { Background } from '../src/ruleset/schemas/BackgroundSchema';
import * as path from 'path';

// --- Spell configuration per class ---
const SPELL_LIMITS: Record<string, { cantrips: number; spells: number }> = {
    'Wizard':   { cantrips: 3, spells: 6 },
    'Sorcerer': { cantrips: 4, spells: 2 },
    'Warlock':  { cantrips: 2, spells: 2 },
    'Bard':     { cantrips: 2, spells: 4 },
    'Cleric':   { cantrips: 3, spells: 0 },
    'Druid':    { cantrips: 2, spells: 0 },
};

const CASTER_CLASSES = Object.keys(SPELL_LIMITS);

const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

/** Strip "Skill: " prefix from skill names (data inconsistency in class JSONs) */
function normalizeSkill(skill: string): string {
    return skill.replace(/^Skill:\s*/i, '');
}

const POINT_BUY_COSTS: Record<number, number> = {
    8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
};

// --- Helpers ---

function modifier(score: number): string {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

async function pickFromList<T>(rl: readline.Interface, label: string, items: T[], display: (item: T, i: number) => string): Promise<T> {
    console.log(`\n--- ${label} ---`);
    items.forEach((item, i) => console.log(`  ${i + 1}. ${display(item, i)}`));
    while (true) {
        const answer = await rl.question(`Choose (1-${items.length}): `);
        const idx = parseInt(answer) - 1;
        if (idx >= 0 && idx < items.length) return items[idx];
        console.log('  Invalid choice, try again.');
    }
}

async function pickMultiple<T>(rl: readline.Interface, label: string, items: T[], count: number, display: (item: T) => string, alreadySelected: string[] = []): Promise<T[]> {
    const selected: T[] = [];
    console.log(`\n--- ${label} (pick ${count}) ---`);

    while (selected.length < count) {
        const available = items.filter(item => {
            const name = display(item);
            return !selected.some(s => display(s) === name) && !alreadySelected.includes(name);
        });
        if (available.length === 0) break;

        available.forEach((item, i) => console.log(`  ${i + 1}. ${display(item)}`));
        console.log(`  Selected: ${selected.length}/${count}`);

        const answer = await rl.question(`Choose (1-${available.length}): `);
        const idx = parseInt(answer) - 1;
        if (idx >= 0 && idx < available.length) {
            selected.push(available[idx]);
            console.log(`  Added: ${display(available[idx])}`);
        } else {
            console.log('  Invalid choice.');
        }
    }
    return selected;
}

// --- Point Buy ---

async function pointBuyAbilities(rl: readline.Interface): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};
    for (const ab of ABILITY_NAMES) stats[ab] = 8;
    let remaining = 27;

    console.log('\n--- Ability Scores (Point Buy: 27 points) ---');
    console.log('  Costs: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7, 15=9');

    for (const ab of ABILITY_NAMES) {
        while (true) {
            console.log(`  Points remaining: ${remaining}`);
            const answer = await rl.question(`  ${ab} (8-15, current=${stats[ab]}): `);
            const val = parseInt(answer);
            if (val >= 8 && val <= 15) {
                const cost = POINT_BUY_COSTS[val] - POINT_BUY_COSTS[stats[ab]];
                if (cost <= remaining) {
                    remaining -= cost;
                    stats[ab] = val;
                    break;
                } else {
                    console.log(`  Not enough points (need ${cost}, have ${remaining}).`);
                }
            } else {
                console.log('  Value must be 8-15.');
            }
        }
    }

    console.log(`\n  Final stats: ${ABILITY_NAMES.map(a => `${a}:${stats[a]}(${modifier(stats[a])})`).join('  ')}`);
    console.log(`  Points spent: ${27 - remaining}/27`);
    return stats;
}

// --- Main Wizard ---

export async function runCreationWizard(rl?: readline.Interface, projectRoot?: string): Promise<{ state: any; savePath: string } | null> {
    const ownRl = !rl;
    if (!rl) rl = readline.createInterface({ input, output });
    const root = projectRoot || (await bootstrapCLI());

    try {
        console.log('\n╔════════════════════════════════════╗');
        console.log('║      CHARACTER CREATION WIZARD      ║');
        console.log('╚════════════════════════════════════╝');

        // Step 1: Name
        const name = await rl.question('\nCharacter name: ');
        if (!name.trim()) { console.log('Name cannot be empty.'); return null; }

        // Step 2: Sex
        const sex = await pickFromList(rl, 'Sex', ['male', 'female'] as const, s => s);

        // Step 3: Race
        const races = DataManager.getRaces();
        const race = await pickFromList(rl, 'Race', races, (r: Race) => {
            const bonuses = Object.entries(r.abilityScoreIncreases).map(([k, v]) => `${k}+${v}`).join(', ');
            return `${r.name} (${bonuses || 'no bonuses'}) Speed:${r.speed}${r.darkvision ? ` DV:${r.darkvision}ft` : ''}`;
        });

        // Step 4: Class
        const classes = DataManager.getClasses();
        const charClass = await pickFromList(rl, 'Class', classes, (c: CharacterClass) => {
            return `${c.name} (Hit Die: ${c.hitDie}, Primary: ${c.primaryAbility.join('/')}, Saves: ${c.savingThrowProficiencies.join('/')})`;
        });

        // Step 5: Background
        const backgrounds = DataManager.getBackgrounds();
        const background = await pickFromList(rl, 'Background', backgrounds, (b: Background) => {
            return `${b.name} — Skills: ${b.skillProficiencies.join(', ')} | Gold: ${b.startingGold}gp`;
        });

        // Step 6: Abilities
        const abilities = await pointBuyAbilities(rl);

        // Step 7: Skills
        const autoSkills = background.skillProficiencies.map(normalizeSkill);
        console.log(`\n  Auto-granted skills from ${background.name}: ${autoSkills.join(', ')}`);
        const availableSkills = charClass.skillChoices.options
            .map(normalizeSkill)
            .filter(s => !autoSkills.includes(s));
        const pickedSkills = await pickMultiple(
            rl, `Class Skills (${charClass.name})`,
            availableSkills, charClass.skillChoices.count,
            (s: string) => s, autoSkills
        );
        const allSkills = [...new Set([...autoSkills, ...pickedSkills])];

        // Step 8: Spells (if caster)
        let selectedCantrips: string[] = [];
        let selectedSpells: string[] = [];

        if (CASTER_CLASSES.includes(charClass.name)) {
            const limits = SPELL_LIMITS[charClass.name];

            // Cantrips
            if (limits.cantrips > 0) {
                const cantrips = DataManager.getSpellsByClass(charClass.name, 0)
                    .filter(s => s.level === 0);
                if (cantrips.length > 0) {
                    const picked = await pickMultiple(
                        rl, `Cantrips (${charClass.name})`,
                        cantrips, Math.min(limits.cantrips, cantrips.length),
                        s => `${s.name} — ${s.school || ''}`
                    );
                    selectedCantrips = picked.map(s => s.name);
                }
            }

            // Level 1 Spells
            if (limits.spells > 0) {
                const spells = DataManager.getSpellsByClass(charClass.name, 1)
                    .filter(s => s.level === 1);
                if (spells.length > 0) {
                    const picked = await pickMultiple(
                        rl, `Level 1 Spells (${charClass.name})`,
                        spells, Math.min(limits.spells, spells.length),
                        s => `${s.name} — ${s.school || ''}`
                    );
                    selectedSpells = picked.map(s => s.name);
                }
            }
        }

        // Step 9: Review
        const finalStats = { ...abilities };
        for (const [stat, bonus] of Object.entries(race.abilityScoreIncreases)) {
            if (finalStats[stat] !== undefined) finalStats[stat] += bonus;
        }
        const conMod = Math.floor((finalStats['CON'] - 10) / 2);
        const hitDie = parseInt(charClass.hitDie.replace('1d', ''));
        const maxHp = hitDie + conMod;

        console.log('\n╔════════════════════════════════════╗');
        console.log('║         CHARACTER SUMMARY           ║');
        console.log('╚════════════════════════════════════╝');
        console.log(`  Name:       ${name} (${sex})`);
        console.log(`  Race:       ${race.name}`);
        console.log(`  Class:      ${charClass.name} (${charClass.hitDie})`);
        console.log(`  Background: ${background.name}`);
        console.log(`  HP:         ${maxHp}`);
        console.log(`  AC:         ${10 + Math.floor((finalStats['DEX'] - 10) / 2)}`);
        console.log(`  Stats:      ${ABILITY_NAMES.map(a => `${a}:${finalStats[a]}(${modifier(finalStats[a])})`).join('  ')}`);
        console.log(`  Skills:     ${allSkills.join(', ')}`);
        if (selectedCantrips.length) console.log(`  Cantrips:   ${selectedCantrips.join(', ')}`);
        if (selectedSpells.length) console.log(`  Spells:     ${selectedSpells.join(', ')}`);

        const confirm = await rl.question('\nCreate this character? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('Character creation cancelled.');
            return null;
        }

        // Create GameState
        const options: CharacterCreationOptions = {
            name: name.trim(),
            sex,
            race,
            characterClass: charClass,
            background,
            abilityScores: abilities,
            skillProficiencies: allSkills,
            selectedCantrips,
            selectedSpells,
        };

        const state = CharacterFactory.createNewGameState(options);

        // Save
        const savesDir = path.join(root, 'saves');
        const storage = new FileStorageProvider();
        const stateManager = new GameStateManager(savesDir, storage);
        await stateManager.saveGame(state, `${name}'s Adventure`);

        console.log(`\nCharacter "${name}" created and saved!`);
        console.log(`Save ID: ${state.saveId}`);

        return { state, savePath: savesDir };
    } finally {
        if (ownRl) rl.close();
    }
}

/**
 * Quick character creation with defaults (for testing / fast start).
 */
export function createQuickCharacter(overrides?: Partial<{
    name: string;
    sex: 'male' | 'female';
    raceName: string;
    className: string;
    backgroundName: string;
    abilities: Record<string, number>;
}>): any {
    const raceName = overrides?.raceName || 'Human';
    const className = overrides?.className || 'Fighter';
    const bgName = overrides?.backgroundName || 'Soldier';

    const race = DataManager.getRace(raceName);
    const charClass = DataManager.getClass(className);
    const background = DataManager.getBackground(bgName);

    if (!race || !charClass || !background) {
        throw new Error(`Missing data: race=${raceName}(${!!race}) class=${className}(${!!charClass}) bg=${bgName}(${!!background})`);
    }

    const abilities = overrides?.abilities || { STR: 15, DEX: 13, CON: 14, INT: 10, WIS: 12, CHA: 8 };

    // Auto-select skills (normalize "Skill: X" prefix from class data)
    const autoSkills = background.skillProficiencies.map(normalizeSkill);
    const classSkills = charClass.skillChoices.options
        .map(normalizeSkill)
        .filter(s => !autoSkills.includes(s))
        .slice(0, charClass.skillChoices.count);
    const allSkills = [...new Set([...autoSkills, ...classSkills])];

    // Auto-select spells for casters
    let cantrips: string[] = [];
    let spells: string[] = [];
    if (CASTER_CLASSES.includes(className)) {
        const limits = SPELL_LIMITS[className];
        cantrips = DataManager.getSpellsByClass(className, 0)
            .filter(s => s.level === 0)
            .slice(0, limits.cantrips)
            .map(s => s.name);
        spells = DataManager.getSpellsByClass(className, 1)
            .filter(s => s.level === 1)
            .slice(0, limits.spells)
            .map(s => s.name);
    }

    return CharacterFactory.createNewGameState({
        name: overrides?.name || `Test ${className}`,
        sex: overrides?.sex || 'male',
        race,
        characterClass: charClass,
        background,
        abilityScores: abilities,
        skillProficiencies: allSkills,
        selectedCantrips: cantrips,
        selectedSpells: spells,
    });
}

// --- CLI Entry Point ---
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('creation.ts')) {
    bootstrapCLI().then(() => runCreationWizard()).catch(console.error);
}
