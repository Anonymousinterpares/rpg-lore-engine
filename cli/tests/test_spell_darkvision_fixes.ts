/**
 * Test: Spell upcasting, scroll casting, darkvision chain
 */
import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { DataManager } from '../../src/ruleset/data/DataManager';
import { CharacterFactory, CharacterCreationOptions } from '../../src/ruleset/factories/CharacterFactory';
import { VisibilityEngine } from '../../src/ruleset/combat/VisibilityEngine';
import { CombatFactory } from '../../src/ruleset/combat/CombatFactory';
import path from 'path';

let pass = 0;
let fail = 0;
function assert(condition: boolean, label: string) {
    if (condition) { console.log(`  [PASS] ${label}`); pass++; }
    else { console.log(`  [FAIL] ${label}`); fail++; }
}

async function main() {
    const root = await bootstrapCLI();
    console.log('=== Spell Upcasting, Scrolls & Darkvision Test ===\n');

    // --- 1. Spell scaling data exists ---
    console.log('--- 1. Spell scaling data ---');
    const fireball = DataManager.getSpell('Fireball');
    assert(!!fireball, 'Fireball spell loaded');
    assert(!!(fireball as any)?.damage?.scaling, 'Fireball has scaling data');
    assert((fireball as any)?.damage?.scaling?.levels?.includes(4), 'Fireball scales at level 4');
    assert((fireball as any)?.damage?.scaling?.values?.[0] === '9d6', 'Fireball at level 4 = 9d6');

    const cure = DataManager.getSpell('Cure_Wounds') || DataManager.getSpell('Cure Wounds');
    if (cure) {
        assert(!!(cure as any)?.damage?.scaling, 'Cure Wounds has scaling data');
        console.log(`  Cure Wounds base: ${(cure as any)?.damage?.dice}, scaling: ${JSON.stringify((cure as any)?.damage?.scaling?.values?.slice(0, 3))}`);
    }

    // --- 2. findAvailableSlot logic ---
    console.log('\n--- 2. Slot fallback ---');
    const state = createQuickCharacter({ name: 'SpellTester', className: 'Wizard' });
    const pc = state.character;
    // Give wizard some spell slots
    pc.spellSlots = {
        '1': { current: 0, max: 4 },  // Depleted!
        '2': { current: 3, max: 3 },
        '3': { current: 2, max: 2 },
    };
    pc.preparedSpells = ['Magic_Missile'];
    pc.knownSpells = ['Magic_Missile'];

    // Test slot fallback logic directly (no combat needed for slot math)
    const savesDir = path.join(root, 'saves', 'test_spell_fix');
    const storage = new FileStorageProvider(savesDir);
    const gl = new GameLoop(state, root, storage);
    await gl.initialize();

    // Test findAvailableSlot: level 1 depleted, should find level 2
    const sm = (gl as any).spells;
    const foundSlot = sm.findAvailableSlot(pc, 1);
    assert(foundSlot === 2, `findAvailableSlot(1) = 2 when level 1 depleted (got ${foundSlot})`);

    // Test findAvailableSlot: level 3 available
    const foundSlot3 = sm.findAvailableSlot(pc, 3);
    assert(foundSlot3 === 3, `findAvailableSlot(3) = 3 (got ${foundSlot3})`);

    // Test findAvailableSlot: all depleted
    pc.spellSlots = { '1': { current: 0, max: 4 }, '2': { current: 0, max: 3 }, '3': { current: 0, max: 2 } };
    const noSlot = sm.findAvailableSlot(pc, 1);
    assert(noSlot === -1, `findAvailableSlot returns -1 when all depleted (got ${noSlot})`);

    // --- 3. Upcast scaling verification ---
    console.log('\n--- 3. Upcast scaling data ---');
    const fb = DataManager.getSpell('Fireball') as any;
    // At level 4, Fireball should do 9d6
    const scalingIdx = fb.damage.scaling.levels.indexOf(4);
    assert(scalingIdx !== -1, 'Fireball has level 4 scaling');
    assert(fb.damage.scaling.values[scalingIdx] === '9d6', `Level 4 = 9d6 (got ${fb.damage.scaling.values[scalingIdx]})`);
    // At level 5, should do 10d6
    const idx5 = fb.damage.scaling.levels.indexOf(5);
    assert(fb.damage.scaling.values[idx5] === '10d6', `Level 5 = 10d6 (got ${fb.damage.scaling.values[idx5]})`);

    // Verify spell clone with scaling would use correct dice
    const castSlotLevel = 5;
    const scalingIndex = fb.damage.scaling.levels.indexOf(castSlotLevel);
    const effectiveDice = scalingIndex !== -1 ? fb.damage.scaling.values[scalingIndex] : fb.damage.dice;
    assert(effectiveDice === '10d6', `Effective dice at slot 5 = 10d6 (got ${effectiveDice})`);
    const baseDice = fb.damage.dice;
    assert(baseDice === '8d6', `Base dice = 8d6 (got ${baseDice})`);

    // --- 4. Spell scroll in inventory ---
    console.log('\n--- 4. Spell scroll usage ---');
    pc.inventory.items.push({
        id: 'scroll_fireball',
        instanceId: 'scroll_test_001',
        name: 'Spell Scroll: Fireball',
        type: 'Spell Scroll',
        spellName: 'Fireball',
        spellLevel: 3,
        weight: 0,
        quantity: 1,
        equipped: false,
        consumedOnUse: true,
    } as any);

    const scrollBefore = pc.inventory.items.find((i: any) => i.instanceId === 'scroll_test_001');
    assert(!!scrollBefore, 'Scroll in inventory');

    const scrollResult = await gl.processTurn('/use scroll_test_001');
    console.log(`  Scroll result: ${scrollResult.substring(0, 80)}...`);
    assert(scrollResult.includes('Fireball') || scrollResult.includes('scroll'), 'Scroll cast produced result');

    const scrollAfter = pc.inventory.items.find((i: any) => i.instanceId === 'scroll_test_001');
    assert(!scrollAfter, 'Scroll consumed after use');

    // --- 5. Darkvision — Elf character ---
    console.log('\n--- 5. Darkvision chain ---');
    const elfRace = DataManager.getRace('Elf');
    assert(!!elfRace, 'Elf race loaded');
    assert((elfRace as any)?.darkvision === 60, `Elf darkvision = 60 (got ${(elfRace as any)?.darkvision})`);

    const humanRace = DataManager.getRace('Human');
    assert((humanRace as any)?.darkvision === 0, `Human darkvision = 0`);

    // Create Elf character
    if (elfRace) {
        const elfOptions: CharacterCreationOptions = {
            name: 'DarkEyes',
            sex: 'female' as any,
            race: elfRace,
            characterClass: DataManager.getClass('Ranger')!,
            background: DataManager.getBackground('Folk Hero')!,
            abilityScores: { STR: 10, DEX: 16, CON: 12, INT: 10, WIS: 14, CHA: 8 },
            skillProficiencies: ['Perception', 'Stealth', 'Survival', 'Animal Handling'],
        };
        const elfState = CharacterFactory.createNewGameState(elfOptions);
        const elfPc = elfState.character;

        assert((elfPc as any).darkvision === 60, `Elf PC darkvision = 60 (got ${(elfPc as any).darkvision})`);

        // Create combatant from Elf PC
        const combatant = CombatFactory.fromPlayer(elfPc);
        assert((combatant as any).darkvision === 60, `Elf combatant darkvision = 60 (got ${(combatant as any).darkvision})`);

        // VisibilityEngine — Elf in darkness
        const elfInDark = VisibilityEngine.getVisibilityEffect(elfPc as any, 'Darkness');
        assert(elfInDark.disadvantage === true, 'Elf in darkness: disadvantage (dim equivalent)');
        assert(elfInDark.blinded === false, 'Elf in darkness: NOT blinded');

        // Human in darkness
        const humanState = createQuickCharacter({ name: 'BlindHuman' });
        const humanInDark = VisibilityEngine.getVisibilityEffect(humanState.character as any, 'Darkness');
        assert(humanInDark.blinded === true, 'Human in darkness: blinded');

        // Elf in dim light
        const elfInDim = VisibilityEngine.getVisibilityEffect(elfPc as any, 'Dim');
        assert(elfInDim.disadvantage === false, 'Elf in dim light: no disadvantage');
        assert(elfInDim.blinded === false, 'Elf in dim light: NOT blinded');
    }

    console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
    process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
