/**
 * Multiclass Skill Advancement Test
 * Tests: /multiclass execution, /levelup with class choice, SP from correct class.
 */
import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { LevelingEngine } from '../../src/ruleset/combat/LevelingEngine';
import { SkillEngine } from '../../src/ruleset/combat/SkillEngine';
import path from 'path';

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string) {
    if (condition) { console.log(`  [PASS] ${label}`); pass++; }
    else { console.log(`  [FAIL] ${label}`); fail++; }
}

async function main() {
    const root = await bootstrapCLI();
    console.log('=== Multiclass Skill Advancement Test ===\n');

    const state = createQuickCharacter({ name: 'MultiTester' });
    const pc = state.character;
    // Quick start is a Fighter with STR 15, DEX 13 — meets Rogue prereq (DEX 13)
    pc.stats['DEX'] = 14; // Ensure DEX >= 13 for Rogue

    const savesDir = path.join(root, 'saves', 'test_multiclass');
    const storage = new FileStorageProvider(savesDir);
    const gl = new GameLoop(state, root, storage);
    await gl.initialize();

    // --- 1. Multiclass into Rogue ---
    console.log('--- 1. Multiclass into Rogue ---');
    const mcResult = await gl.processTurn('/multiclass Rogue');
    console.log(`  ${mcResult}`);
    assert(mcResult.includes('Multiclassed into Rogue'), 'Multiclass executed');
    assert(pc.secondaryClass === 'Rogue', `secondaryClass = Rogue (got ${pc.secondaryClass})`);
    assert(!!pc.multiclassLevels, 'multiclassLevels initialized');
    assert(pc.multiclassLevels?.['Fighter'] === 1, `Fighter level = 1 (got ${pc.multiclassLevels?.['Fighter']})`);
    assert(pc.multiclassLevels?.['Rogue'] === 0, `Rogue level = 0 (got ${pc.multiclassLevels?.['Rogue']})`);

    // --- 2. Max 2 classes ---
    console.log('\n--- 2. Max 2 classes ---');
    const mc2 = await gl.processTurn('/multiclass Wizard');
    console.log(`  ${mc2}`);
    assert(mc2.includes('Maximum 2 classes'), 'Third class rejected');

    // --- 3. Level up requires class choice ---
    console.log('\n--- 3. Level up requires class choice ---');
    pc.xp = 300; // Enough for level 2
    const lvlNoChoice = await gl.processTurn('/levelup');
    console.log(`  ${lvlNoChoice}`);
    assert(lvlNoChoice.includes('specify class'), 'Level up without class rejected');
    assert(pc.level === 1, 'Level unchanged');

    // --- 4. Level up as Fighter ---
    console.log('\n--- 4. Level up as Fighter ---');
    const spBefore = (pc as any).skillPoints.available;
    const lvlFighter = await gl.processTurn('/levelup Fighter');
    console.log(`  ${lvlFighter}`);
    assert(pc.level === 2, `Level = 2 (got ${pc.level})`);
    assert(pc.multiclassLevels?.['Fighter'] === 2, `Fighter level = 2 (got ${pc.multiclassLevels?.['Fighter']})`);
    assert(pc.multiclassLevels?.['Rogue'] === 0, `Rogue level still 0`);
    // Fighter gives 2 SP
    assert((pc as any).skillPoints.available === spBefore + 2, `SP +2 from Fighter (${spBefore} → ${(pc as any).skillPoints.available})`);

    // --- 5. Level up as Rogue ---
    console.log('\n--- 5. Level up as Rogue ---');
    pc.xp = 900; // Enough for level 3
    const spBefore2 = (pc as any).skillPoints.available;
    const lvlRogue = await gl.processTurn('/levelup Rogue');
    console.log(`  ${lvlRogue}`);
    assert(pc.level === 3, `Level = 3 (got ${pc.level})`);
    assert(pc.multiclassLevels?.['Rogue'] === 1, `Rogue level = 1 (got ${pc.multiclassLevels?.['Rogue']})`);
    // Rogue gives 3 SP
    assert((pc as any).skillPoints.available === spBefore2 + 3, `SP +3 from Rogue (${spBefore2} → ${(pc as any).skillPoints.available})`);

    // --- 6. Invalid class on level up ---
    console.log('\n--- 6. Invalid class on level up ---');
    pc.xp = 2700;
    const lvlBad = await gl.processTurn('/levelup Wizard');
    console.log(`  ${lvlBad}`);
    assert(lvlBad.includes('not one of your classes'), 'Invalid class rejected');
    assert(pc.level === 3, 'Level unchanged after invalid choice');

    // --- 7. Single-class character still works without arg ---
    console.log('\n--- 7. Single-class level up (no multiclass) ---');
    const singleState = createQuickCharacter({ name: 'SingleTester' });
    const singlePc = singleState.character;
    singlePc.xp = 300;
    const singleResult = LevelingEngine.levelUp(singlePc);
    console.log(`  ${singleResult}`);
    assert(singlePc.level === 2, 'Single-class leveled up without class arg');

    console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
    process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
