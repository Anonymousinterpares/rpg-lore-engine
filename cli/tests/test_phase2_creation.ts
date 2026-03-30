/**
 * Phase 2 Test: Verify character creation for all 12 classes + save/load
 *
 * Run: npx tsx cli/tests/test_phase2_creation.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { DataManager } from '../../src/ruleset/data/DataManager';
import { GameStateManager } from '../../src/ruleset/combat/GameStateManager';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
    if (condition) {
        console.log(`  [PASS] ${label}`);
        passed++;
    } else {
        console.log(`  [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
        failed++;
    }
}

const CLASS_BACKGROUNDS: Record<string, string> = {
    'Barbarian': 'Soldier',
    'Bard': 'Criminal',
    'Cleric': 'Acolyte',
    'Druid': 'Acolyte',
    'Fighter': 'Soldier',
    'Monk': 'Acolyte',
    'Paladin': 'Noble',
    'Ranger': 'Folk Hero',
    'Rogue': 'Criminal',
    'Sorcerer': 'Sage',
    'Warlock': 'Criminal',
    'Wizard': 'Sage',
};

const CASTER_CLASSES = ['Wizard', 'Sorcerer', 'Warlock', 'Bard', 'Cleric', 'Druid'];

async function main() {
    console.log('=== Phase 2: Character Creation Test ===\n');
    const root = await bootstrapCLI();

    const classes = DataManager.getClasses();
    assert(classes.length === 12, `12 classes available: ${classes.length}`);

    // --- Test all 12 classes ---
    console.log('\n--- Creating characters for all 12 classes ---');
    const createdStates: any[] = [];

    for (const cls of classes) {
        const bgName = CLASS_BACKGROUNDS[cls.name] || 'Soldier';
        try {
            const state = createQuickCharacter({
                name: `Test ${cls.name}`,
                className: cls.name,
                backgroundName: bgName,
            });
            createdStates.push(state);

            assert(state.character.name === `Test ${cls.name}`, `${cls.name}: name correct`);
            assert(state.character.class === cls.name, `${cls.name}: class set`);
            assert(state.character.level === 1, `${cls.name}: level 1`);
            assert(state.character.hp.max > 0, `${cls.name}: HP=${state.character.hp.max}`);
            assert(state.character.hp.current === state.character.hp.max, `${cls.name}: full HP`);
            assert(state.character.inventory.items.length > 0, `${cls.name}: has starting items (${state.character.inventory.items.length})`);
            assert(state.worldMap.hexes['0,0'] !== undefined, `${cls.name}: starting hex exists`);
            assert(state.activeQuests.length > 0, `${cls.name}: has tutorial quest`);
            assert(state.mode === 'EXPLORATION', `${cls.name}: starts in EXPLORATION`);
            assert(state.saveId && state.saveId.length > 0, `${cls.name}: has saveId`);

        } catch (e) {
            console.log(`  [FAIL] ${cls.name}: CRASHED — ${(e as Error).message}`);
            failed++;
        }
    }

    // --- Caster-specific checks ---
    console.log('\n--- Caster-specific checks ---');
    for (const className of CASTER_CLASSES) {
        const state = createdStates.find(s => s.character.class === className);
        if (!state) {
            console.log(`  [FAIL] ${className}: state not found`);
            failed++;
            continue;
        }

        if (className === 'Wizard') {
            assert(state.character.spellbook.length > 0, `Wizard: has spellbook (${state.character.spellbook.length} spells)`);
            assert(state.character.cantripsKnown.length > 0, `Wizard: has cantrips (${state.character.cantripsKnown.length})`);
        } else {
            assert(
                state.character.cantripsKnown.length > 0,
                `${className}: has cantrips (${state.character.cantripsKnown.length})`
            );
        }
    }

    // --- Non-caster check ---
    console.log('\n--- Non-caster checks ---');
    const fighter = createdStates.find(s => s.character.class === 'Fighter');
    if (fighter) {
        assert(fighter.character.cantripsKnown.length === 0, 'Fighter: no cantrips');
        assert(fighter.character.knownSpells.length === 0, 'Fighter: no known spells');
        assert(fighter.character.spellbook.length === 0, 'Fighter: no spellbook');
    }

    // --- Save / Load round-trip ---
    console.log('\n--- Save / Load Round-Trip ---');
    const testState = createdStates[0];
    if (testState) {
        const savesDir = path.join(root, 'saves', 'cli_test');
        const storage = new FileStorageProvider();
        const stateManager = new GameStateManager(savesDir, storage);

        await stateManager.saveGame(testState, 'Test Save');
        const registry = await stateManager.getSaveRegistry();
        assert(registry.slots.length > 0, `Save registry has entries: ${registry.slots.length}`);

        const loaded = await stateManager.loadGame(testState.saveId);
        assert(loaded !== null, 'Loaded game is not null');
        if (loaded) {
            assert(loaded.character.name === testState.character.name, `Loaded name matches: "${loaded.character.name}"`);
            assert(loaded.character.class === testState.character.class, `Loaded class matches: "${loaded.character.class}"`);
            assert(loaded.character.hp.max === testState.character.hp.max, `Loaded HP matches: ${loaded.character.hp.max}`);
            assert(loaded.saveId === testState.saveId, 'Loaded saveId matches');
        }

        // Clean up test save
        await stateManager.deleteSave(testState.saveId);
    }

    // --- Stat validation ---
    console.log('\n--- Stat Validation ---');
    const humanFighter = createQuickCharacter({
        name: 'Stat Test',
        raceName: 'Human',
        className: 'Fighter',
        abilities: { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 },
    });
    // Human gets +1 to all stats
    const human = DataManager.getRace('Human')!;
    const expectedStr = 15 + (human.abilityScoreIncreases['STR'] || 0);
    assert(humanFighter.character.stats.STR === expectedStr, `Human Fighter STR: ${humanFighter.character.stats.STR} === ${expectedStr} (15 + racial)`);

    const conMod = Math.floor((humanFighter.character.stats.CON - 10) / 2);
    const expectedHp = 10 + conMod; // Fighter d10
    assert(humanFighter.character.hp.max === expectedHp, `Human Fighter HP: ${humanFighter.character.hp.max} === ${expectedHp} (d10 + CON mod ${conMod})`);

    // --- Summary ---
    console.log('\n============================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log('============================');

    if (failed > 0) process.exit(1);
}

main().catch(e => {
    console.error('Test crashed:', e);
    process.exit(1);
});
