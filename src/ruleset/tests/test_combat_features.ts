import { CombatResolutionEngine } from '../combat/CombatResolutionEngine';

function makeCombatant(overrides: any = {}) {
    return {
        name: 'Test', hp: { current: 50, max: 50, temp: 0 }, ac: 13,
        stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        statusEffects: [], conditions: [],
        position: { x: 0, y: 0 },
        tactical: { cover: 'None', reach: 1, isRanged: false },
        type: 'player', id: 'p1', isPlayer: true, initiative: 10, dexterityScore: 10,
        resources: { actionSpent: false, bonusActionSpent: false, reactionSpent: false },
        preparedSpells: [], spellSlots: {},
        movementSpeed: 6, movementRemaining: 6, size: 'Medium', darkvision: 0,
        ...overrides
    } as any;
}

let passed = 0, failed = 0;

function assert(name: string, condition: boolean, detail: string) {
    if (condition) { console.log(`  ✅ ${name}: ${detail}`); passed++; }
    else { console.log(`  ❌ FAIL ${name}: ${detail}`); failed++; }
}

// === TEST 1: IMPROVED CRITICAL ===
console.log('\n=== IMPROVED CRITICAL ===');
{
    const runs = 3000;
    let crits19 = 0, critsNormal = 0, crits18 = 0;
    const attacker = makeCombatant({ name: 'Fighter' });
    const target = makeCombatant({ name: 'Goblin', type: 'enemy', id: 'e1', isPlayer: false });

    for (let i = 0; i < runs; i++) {
        const r = CombatResolutionEngine.resolveAttack(attacker, target, [{ label: 'STR', value: 5, source: 'Stat' }], '1d8', 3, false, false, 'Bright',
            { critRange: 19, sneakAttackDice: 0, hasAllyNearTarget: false, isFinesseOrRanged: false });
        if (r.type === 'CRIT') crits19++;
    }
    for (let i = 0; i < runs; i++) {
        const r = CombatResolutionEngine.resolveAttack(attacker, target, [{ label: 'STR', value: 5, source: 'Stat' }], '1d8', 3, false, false, 'Bright');
        if (r.type === 'CRIT') critsNormal++;
    }
    for (let i = 0; i < runs; i++) {
        const r = CombatResolutionEngine.resolveAttack(attacker, target, [{ label: 'STR', value: 5, source: 'Stat' }], '1d8', 3, false, false, 'Bright',
            { critRange: 18, sneakAttackDice: 0, hasAllyNearTarget: false, isFinesseOrRanged: false });
        if (r.type === 'CRIT') crits18++;
    }

    const rate19 = crits19 / runs * 100;
    const rateNorm = critsNormal / runs * 100;
    const rate18 = crits18 / runs * 100;

    assert('Normal crit ~5%', rateNorm > 2.5 && rateNorm < 8, `${rateNorm.toFixed(1)}%`);
    assert('Improved crit (19+) ~10%', rate19 > 7 && rate19 < 14, `${rate19.toFixed(1)}%`);
    assert('Superior crit (18+) ~15%', rate18 > 11 && rate18 < 19, `${rate18.toFixed(1)}%`);
    assert('19+ has MORE crits than 20', crits19 > critsNormal, `${crits19} > ${critsNormal}`);
    assert('18+ has MORE crits than 19+', crits18 > crits19, `${crits18} > ${crits19}`);
}

// === TEST 2: SNEAK ATTACK ===
console.log('\n=== SNEAK ATTACK ===');
{
    const attacker = makeCombatant({ name: 'Rogue', stats: { DEX: 18 } });
    const attackerAdv = makeCombatant({ name: 'Rogue', stats: { DEX: 18 }, statusEffects: [{ id: 'press_advantage', name: 'Advantage', type: 'BUFF' }] });
    const target = makeCombatant({ name: 'Goblin', ac: 8, type: 'enemy', id: 'e1', isPlayer: false });

    // With advantage + finesse → sneak attack triggers
    let sneakWithAdv = 0, dmgWithAdv = 0;
    for (let i = 0; i < 200; i++) {
        const r = CombatResolutionEngine.resolveAttack(attackerAdv, target, [{ label: 'DEX', value: 6, source: 'Stat' }], '1d6', 4, false, false, 'Bright',
            { critRange: 20, sneakAttackDice: 5, hasAllyNearTarget: false, isFinesseOrRanged: true });
        if (r.message.includes('Sneak Attack')) { sneakWithAdv++; dmgWithAdv += r.damage; }
    }
    assert('Sneak triggers with advantage+finesse', sneakWithAdv > 100, `${sneakWithAdv}/200 hits had sneak`);

    // Without advantage, without ally → no sneak
    let sneakNoEligible = 0;
    for (let i = 0; i < 300; i++) {
        const r = CombatResolutionEngine.resolveAttack(attacker, target, [{ label: 'DEX', value: 6, source: 'Stat' }], '1d6', 4, false, false, 'Bright',
            { critRange: 20, sneakAttackDice: 5, hasAllyNearTarget: false, isFinesseOrRanged: true });
        if (r.message.includes('Sneak Attack')) sneakNoEligible++;
    }
    assert('No sneak without advantage/ally', sneakNoEligible === 0, `${sneakNoEligible} false positives`);

    // With ally near target, no advantage → sneak triggers
    let sneakWithAlly = 0;
    for (let i = 0; i < 200; i++) {
        const r = CombatResolutionEngine.resolveAttack(attacker, target, [{ label: 'DEX', value: 6, source: 'Stat' }], '1d6', 4, false, false, 'Bright',
            { critRange: 20, sneakAttackDice: 5, hasAllyNearTarget: true, isFinesseOrRanged: true });
        if (r.message.includes('Sneak Attack')) sneakWithAlly++;
    }
    assert('Sneak triggers with ally near target', sneakWithAlly > 100, `${sneakWithAlly}/200`);

    // Non-finesse weapon → no sneak even with advantage
    let sneakNonFinesse = 0;
    for (let i = 0; i < 300; i++) {
        const r = CombatResolutionEngine.resolveAttack(attackerAdv, target, [{ label: 'STR', value: 4, source: 'Stat' }], '1d10', 2, false, false, 'Bright',
            { critRange: 20, sneakAttackDice: 5, hasAllyNearTarget: false, isFinesseOrRanged: false });
        if (r.message.includes('Sneak Attack')) sneakNonFinesse++;
    }
    assert('No sneak with non-finesse weapon', sneakNonFinesse === 0, `${sneakNonFinesse} false positives`);

    // Ranged weapon with ally near target → sneak triggers (ranged + ally is the common ranged sneak path)
    let sneakRanged = 0;
    for (let i = 0; i < 200; i++) {
        const r = CombatResolutionEngine.resolveAttack(attacker, target, [{ label: 'DEX', value: 6, source: 'Stat' }], '1d6', 4, true, false, 'Bright',
            { critRange: 20, sneakAttackDice: 5, hasAllyNearTarget: true, isFinesseOrRanged: true });
        if (r.message.includes('Sneak Attack')) sneakRanged++;
    }
    assert('Sneak triggers with ranged weapon+ally', sneakRanged > 100, `${sneakRanged}/200`);

    // 0 sneak dice (non-rogue) → no sneak
    let sneakZeroDice = 0;
    for (let i = 0; i < 200; i++) {
        const r = CombatResolutionEngine.resolveAttack(attackerAdv, target, [{ label: 'DEX', value: 6, source: 'Stat' }], '1d6', 4, false, false, 'Bright',
            { critRange: 20, sneakAttackDice: 0, hasAllyNearTarget: true, isFinesseOrRanged: true });
        if (r.message.includes('Sneak Attack')) sneakZeroDice++;
    }
    assert('No sneak with 0 dice (non-rogue)', sneakZeroDice === 0, `${sneakZeroDice} false positives`);
}

// === TEST 3: SNEAK ATTACK DAMAGE SCALING ===
console.log('\n=== SNEAK ATTACK DAMAGE SCALING ===');
{
    const attackerAdv = makeCombatant({ name: 'Rogue', stats: { DEX: 20 }, statusEffects: [{ id: 'press_advantage', name: 'Advantage', type: 'BUFF' }] });
    const target = makeCombatant({ name: 'Dummy', ac: 5, hp: { current: 500, max: 500, temp: 0 }, type: 'enemy', id: 'e1', isPlayer: false });

    // 1d6 sneak (level 1 rogue)
    let dmg1 = 0, hits1 = 0;
    for (let i = 0; i < 500; i++) {
        const r = CombatResolutionEngine.resolveAttack(attackerAdv, target, [{ label: 'DEX', value: 7, source: 'Stat' }], '1d6', 5, false, false, 'Bright',
            { critRange: 20, sneakAttackDice: 1, hasAllyNearTarget: false, isFinesseOrRanged: true });
        if (r.damage > 0) { dmg1 += r.damage; hits1++; }
    }
    const avg1 = dmg1 / hits1;

    // 5d6 sneak (level 10 rogue)
    let dmg5 = 0, hits5 = 0;
    for (let i = 0; i < 500; i++) {
        const r = CombatResolutionEngine.resolveAttack(attackerAdv, target, [{ label: 'DEX', value: 7, source: 'Stat' }], '1d6', 5, false, false, 'Bright',
            { critRange: 20, sneakAttackDice: 5, hasAllyNearTarget: false, isFinesseOrRanged: true });
        if (r.damage > 0) { dmg5 += r.damage; hits5++; }
    }
    const avg5 = dmg5 / hits5;

    assert('5d6 sneak does MORE damage than 1d6', avg5 > avg1, `avg 5d6=${avg5.toFixed(1)} vs 1d6=${avg1.toFixed(1)}`);
    assert('5d6 sneak avg > 20', avg5 > 20, `avg=${avg5.toFixed(1)}`);
    assert('1d6 sneak avg > 8', avg1 > 8, `avg=${avg1.toFixed(1)}`);
}

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
