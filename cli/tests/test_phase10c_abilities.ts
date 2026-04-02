/**
 * Phase 10C Integration Test — Skill Abilities (Passive/Active)
 */
import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { SkillEngine } from '../../src/ruleset/combat/SkillEngine';
import { SkillAbilityEngine } from '../../src/ruleset/combat/SkillAbilityEngine';
import { MechanicsEngine } from '../../src/ruleset/combat/MechanicsEngine';

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string) {
    if (condition) { console.log(`  [PASS] ${label}`); pass++; }
    else { console.log(`  [FAIL] ${label}`); fail++; }
}

async function main() {
    await bootstrapCLI();
    console.log('=== Phase 10C: Skill Abilities Test ===\n');

    // --- 1. Ability data loaded ---
    console.log('--- 1. Ability data loaded ---');
    const arcanaChoices = SkillAbilityEngine.getAbilityChoices('Arcana', 3);
    assert(!!arcanaChoices, 'Arcana T3 choices loaded');
    assert(arcanaChoices?.passive.id === 'arcana_t3_p', `Arcana T3 passive: ${arcanaChoices?.passive.name}`);
    assert(arcanaChoices?.active.id === 'arcana_t3_a', `Arcana T3 active: ${arcanaChoices?.active.name}`);

    const allT4 = SkillAbilityEngine.getAbilityChoices('Stealth', 4);
    assert(!!allT4, 'Stealth T4 choices loaded');

    // --- 2. Choose ability ---
    console.log('\n--- 2. Choose ability ---');
    const state = createQuickCharacter({ name: 'AbilityTester' });
    const pc = state.character;
    pc.level = 10;
    SkillEngine.grantSkillPoints(pc, 50);

    // Get Arcana to T3
    SkillEngine.invest(pc, 'Arcana'); // T0→1
    SkillEngine.invest(pc, 'Arcana'); // T1→2
    SkillEngine.invest(pc, 'Arcana'); // T2→3
    assert(SkillEngine.getSkillTier(pc, 'Arcana') === 3, 'Arcana at Tier 3');

    // Choose passive
    const chooseResult = SkillAbilityEngine.chooseAbility(pc, 'Arcana', 3, 'passive');
    console.log(`  ${chooseResult}`);
    assert(chooseResult.includes('Arcane Intuition'), 'Chose Arcana T3 passive');
    assert(SkillAbilityEngine.hasPassiveAbility(pc, 'Arcana', 3), 'hasPassiveAbility returns true');
    assert(!SkillAbilityEngine.hasActiveAbility(pc, 'Arcana', 3), 'hasActiveAbility returns false');

    // --- 3. Choose wrong tier ---
    console.log('\n--- 3. Edge case: choose T4 without reaching it ---');
    const failChoose = SkillAbilityEngine.chooseAbility(pc, 'Arcana', 4, 'active');
    console.log(`  ${failChoose}`);
    assert(failChoose.includes('must be Tier 4'), 'T4 choice rejected at T3');

    // --- 4. Active ability usage ---
    console.log('\n--- 4. Active ability usage ---');
    SkillEngine.invest(pc, 'Persuasion'); // T0→1
    SkillEngine.invest(pc, 'Persuasion'); // T1→2
    SkillEngine.invest(pc, 'Persuasion'); // T2→3
    SkillAbilityEngine.chooseAbility(pc, 'Persuasion', 3, 'active'); // Charm: 1/rest

    assert(SkillAbilityEngine.hasActiveAbility(pc, 'Persuasion', 3), 'Persuasion T3 active chosen');
    assert(SkillAbilityEngine.getRemainingUses(pc, 'Persuasion', 3) === 1, 'Charm: 1 use available');

    const useResult = SkillAbilityEngine.useAbility(pc, 'Persuasion', 3);
    console.log(`  ${useResult.message}`);
    assert(useResult.success, 'Charm used successfully');
    assert(SkillAbilityEngine.getRemainingUses(pc, 'Persuasion', 3) === 0, 'Charm: 0 uses remaining');

    const useAgain = SkillAbilityEngine.useAbility(pc, 'Persuasion', 3);
    assert(!useAgain.success, 'Second use rejected (no uses left)');

    // --- 5. Reset on rest ---
    console.log('\n--- 5. Reset ability uses on rest ---');
    SkillAbilityEngine.resetAbilityUses(pc, 'long');
    assert(SkillAbilityEngine.getRemainingUses(pc, 'Persuasion', 3) === 1, 'Charm restored after long rest');

    // --- 6. Per-encounter ability ---
    console.log('\n--- 6. Per-encounter ability ---');
    SkillEngine.invest(pc, 'Stealth'); // T0→1
    SkillEngine.invest(pc, 'Stealth'); // T1→2
    SkillEngine.invest(pc, 'Stealth'); // T2→3
    SkillAbilityEngine.chooseAbility(pc, 'Stealth', 3, 'active'); // Vanish: 1/encounter

    assert(SkillAbilityEngine.getRemainingUses(pc, 'Stealth', 3) === 1, 'Vanish: 1 use');
    SkillAbilityEngine.useAbility(pc, 'Stealth', 3);
    assert(SkillAbilityEngine.getRemainingUses(pc, 'Stealth', 3) === 0, 'Vanish: 0 after use');

    SkillAbilityEngine.resetEncounterUses(pc);
    assert(SkillAbilityEngine.getRemainingUses(pc, 'Stealth', 3) === 1, 'Vanish restored after encounter');
    // Persuasion (per-rest) should NOT reset on encounter end
    SkillAbilityEngine.useAbility(pc, 'Persuasion', 3); // Use it
    SkillAbilityEngine.resetEncounterUses(pc);
    assert(SkillAbilityEngine.getRemainingUses(pc, 'Persuasion', 3) === 0, 'Charm NOT restored by encounter reset');

    // --- 7. getAvailableAbilities ---
    console.log('\n--- 7. Available abilities list ---');
    const available = SkillAbilityEngine.getAvailableAbilities(pc);
    console.log(`  Active abilities: ${available.length}`);
    assert(available.length === 2, `2 active abilities (Persuasion + Stealth) [got ${available.length}]`);

    // --- 8. Passive Perception +5 ---
    console.log('\n--- 8. Passive effects ---');
    SkillEngine.invest(pc, 'Perception'); // T0→1
    SkillEngine.invest(pc, 'Perception'); // T1→2
    SkillEngine.invest(pc, 'Perception'); // T2→3
    SkillAbilityEngine.chooseAbility(pc, 'Perception', 3, 'passive'); // +5 passive

    const ppWithout = 10 + MechanicsEngine.getModifier(pc.stats['WIS'] || 10);
    const ppWith = MechanicsEngine.getPassivePerception(pc);
    console.log(`  Passive Perception: ${ppWith} (base ~${ppWithout} + prof + ability bonus)`);
    // Should include tier bonus + 5 passive ability bonus
    assert(ppWith > ppWithout, `Passive Perception boosted: ${ppWith} > ${ppWithout}`);

    console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
    process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
