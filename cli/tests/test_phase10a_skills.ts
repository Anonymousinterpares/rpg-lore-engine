/**
 * Phase 10A Integration Test — Skill Tier System, SP, ASI, Difficulty
 * Multi-turn headless gameplay via GameLoop.
 */
import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { SkillEngine } from '../../src/ruleset/combat/SkillEngine';
import { LevelingEngine } from '../../src/ruleset/combat/LevelingEngine';
import { MechanicsEngine } from '../../src/ruleset/combat/MechanicsEngine';
import { DifficultyEngine } from '../../src/ruleset/combat/DifficultyEngine';
import path from 'path';

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string) {
    if (condition) { console.log(`  [PASS] ${label}`); pass++; }
    else { console.log(`  [FAIL] ${label}`); fail++; }
}

async function main() {
    const root = await bootstrapCLI();
    console.log('=== Phase 10A: Skill System Integration Test ===\n');

    // --- 1. Skill Registry ---
    console.log('--- 1. Skill Registry ---');
    const registry = SkillEngine.getRegistry();
    const skillCount = Object.keys(registry).length;
    assert(skillCount === 20, `Registry has 20 skills (got ${skillCount})`);
    assert(registry['Arcana']?.ability === 'INT', 'Arcana ability = INT');
    assert(registry['Athletics']?.ability === 'STR', 'Athletics ability = STR');
    assert(JSON.stringify(registry['Arcana'].tierCosts) === '[2,3,5,8]', 'Arcana tier costs = [2,3,5,8]');
    assert(JSON.stringify(registry['Arcana'].levelGates) === '[1,1,8,15]', 'Arcana level gates = [1,1,8,15]');

    // --- 2. Character Creation with Skills ---
    console.log('\n--- 2. Character creation ---');
    const state = createQuickCharacter({ name: 'SkillTester' });
    const pc = state.character;
    assert(!!(pc as any).skills, 'Character has skills Record');
    assert(!!(pc as any).skillPoints, 'Character has skillPoints');
    assert((pc as any).skillPoints.available === 0, 'Starts with 0 SP');

    const athleticsTier = SkillEngine.getSkillTier(pc, 'Athletics');
    assert(athleticsTier === 1, `Athletics tier = 1 (Proficient) [got ${athleticsTier}]`);

    const arcanaTier = SkillEngine.getSkillTier(pc, 'Arcana');
    // Fighter quick-start may not have Arcana
    console.log(`  Arcana tier: ${arcanaTier} (${arcanaTier === 0 ? 'Untrained — expected for Fighter' : 'Proficient'})`);

    // --- 3. Skill Investment ---
    console.log('\n--- 3. Skill investment ---');
    // Give some SP to test
    SkillEngine.grantSkillPoints(pc, 10);
    assert((pc as any).skillPoints.available === 10, 'Granted 10 SP');

    // Invest in Athletics (Tier 1 → Tier 2, costs 3 SP)
    const investResult = SkillEngine.invest(pc, 'Athletics');
    console.log(`  ${investResult}`);
    assert(SkillEngine.getSkillTier(pc, 'Athletics') === 2, 'Athletics advanced to Tier 2 (Expert)');
    assert((pc as any).skillPoints.available === 7, 'SP reduced by 3 (10-3=7)');

    // Invest in untrained skill (Tier 0 → Tier 1, costs 2 SP)
    const newSkillResult = SkillEngine.invest(pc, 'Arcana');
    console.log(`  ${newSkillResult}`);
    assert(SkillEngine.getSkillTier(pc, 'Arcana') === 1, 'Arcana acquired at Tier 1');
    assert((pc as any).skillPoints.available === 5, 'SP reduced by 2 (7-2=5)');

    // Try investing without enough SP
    (pc as any).skillPoints.available = 1;
    const failInvest = SkillEngine.invest(pc, 'Stealth');
    assert(failInvest.includes('Need'), `Insufficient SP rejected: "${failInvest}"`);

    // --- 4. Level gating ---
    console.log('\n--- 4. Level gating ---');
    (pc as any).skillPoints.available = 20;
    // Tier 2→3 requires level 8
    const investT3 = SkillEngine.invest(pc, 'Athletics'); // Already Tier 2, needs level 8 for Tier 3
    console.log(`  Tier 3 attempt at level 1: ${investT3}`);
    assert(investT3.includes('level 8') || investT3.includes('Requires'), 'Tier 3 blocked by level gate');

    // --- 5. Respec ---
    console.log('\n--- 5. Respec ---');
    const beforeReset = (pc as any).skillPoints.available;
    const resetResult = SkillEngine.resetAll(pc);
    console.log(`  ${resetResult}`);
    assert(SkillEngine.getSkillTier(pc, 'Athletics') === 1, 'Athletics reset to Tier 1 (creation skill preserved)');
    assert(SkillEngine.getSkillTier(pc, 'Arcana') === 0, 'Arcana reset to Tier 0 (acquired via SP)');
    assert((pc as any).skillPoints.available > beforeReset, 'SP refunded');

    // --- 6. Tier-based resolution ---
    console.log('\n--- 6. Tier-based skill check bonuses ---');
    // Re-invest for testing
    (pc as any).skillPoints.available = 20;
    SkillEngine.invest(pc, 'Athletics'); // Tier 0→1
    SkillEngine.invest(pc, 'Athletics'); // Tier 1→2

    const profBonus = MechanicsEngine.getProficiencyBonus(pc.level); // +2 at level 1
    const strMod = MechanicsEngine.getModifier(pc.stats['STR'] || 10);
    // Tier 2 = Expert = 2x proficiency
    const expectedBonus = strMod + (profBonus * 2);
    // Do a check and verify the bonus math
    const result = MechanicsEngine.resolveCheck(pc, 'STR', 'Athletics');
    console.log(`  ${result.message}`);
    assert(result.proficiencyBonus === profBonus * 2, `Prof bonus = ${profBonus}×2 = ${profBonus * 2} (got ${result.proficiencyBonus})`);

    // --- 7. Level Up + SP Grant ---
    console.log('\n--- 7. Level up ---');
    pc.xp = 300; // Enough for level 2
    const spBefore = (pc as any).skillPoints.available;
    const levelResult = LevelingEngine.levelUp(pc);
    console.log(`  ${levelResult}`);
    assert(pc.level === 2, 'Leveled up to 2');
    assert((pc as any).skillPoints.available === spBefore + 2, `SP increased by 2 (Fighter default)`);

    // --- 8. ASI ---
    console.log('\n--- 8. ASI ---');
    // Force to level 4 for ASI
    pc.xp = 6500;
    LevelingEngine.levelUp(pc); // → level 3
    LevelingEngine.levelUp(pc); // → level 4 (ASI!)
    assert(pc.level === 4, 'Reached level 4');
    assert(LevelingEngine.hasPendingASI(pc), 'ASI pending at level 4');

    const strBefore = pc.stats['STR'] || 10;
    const asiResult = LevelingEngine.applyASISingle(pc, 'STR');
    console.log(`  ${asiResult}`);
    assert((pc.stats['STR'] || 0) === strBefore + 2, `STR increased by 2 (${strBefore} → ${pc.stats['STR']})`);
    assert(!LevelingEngine.hasPendingASI(pc), 'ASI consumed');

    // --- 9. SP accumulation across levels ---
    console.log('\n--- 9. SP accumulation ---');
    const spNow = (pc as any).skillPoints.available;
    pc.xp = 14000;
    LevelingEngine.levelUp(pc); // → level 5
    assert((pc as any).skillPoints.available === spNow + 2, 'SP accumulated from level 5');
    // Total should be: initial 0 + 10 granted + refunded from reset + 2+2+2+2 from levels 2-5
    console.log(`  Total SP earned: ${(pc as any).skillPoints.totalEarned}`);

    // --- 10. Difficulty Engine ---
    console.log('\n--- 10. Difficulty scaling ---');
    const easyConfig = DifficultyEngine.getConfig('easy');
    const hardConfig = DifficultyEngine.getConfig('hard');
    assert(easyConfig.enemyHPScale === 0.75, `Easy HP scale = 0.75`);
    assert(hardConfig.enemyHPScale === 1.5, `Hard HP scale = 1.5`);
    assert(DifficultyEngine.scaleEnemyHP(100, 'easy') === 75, 'Easy: 100 HP → 75');
    assert(DifficultyEngine.scaleEnemyHP(100, 'hard') === 150, 'Hard: 100 HP → 150');
    assert(DifficultyEngine.scaleXP(100, 'easy') === 75, 'Easy: 100 XP → 75');
    assert(DifficultyEngine.scaleXP(100, 'hard') === 125, 'Hard: 100 XP → 125');

    // Mid-combat rescale
    const mockCombatant = { isPlayer: false, hp: { current: 50, max: 100 } };
    DifficultyEngine.rescaleCombatantHP(mockCombatant, 'normal', 'hard');
    assert(mockCombatant.hp.max === 150, `Rescale normal→hard: max 100→150 (got ${mockCombatant.hp.max})`);
    assert(mockCombatant.hp.current === 75, `Rescale preserves ratio: 50/100→75/150 (got ${mockCombatant.hp.current})`);

    console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
    process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
