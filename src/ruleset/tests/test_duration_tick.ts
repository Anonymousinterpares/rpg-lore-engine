/**
 * Test: Do status effect durations tick correctly in combat?
 *
 * Scenario: 3 combatants — Player, Ally, Enemy.
 * Player casts Shield (duration=1, sourceId='player').
 * We simulate turns and check when Shield expires.
 *
 * D&D 5e rule: "Until the start of your next turn" = survives through
 * all other combatants' turns, expires when YOUR turn starts again.
 *
 * With 3 combatants, Shield should survive through Ally's turn and Enemy's turn,
 * then expire at the start of Player's NEXT turn.
 */

// We can't easily run the full CombatOrchestrator, so let's directly test
// the processStartOfTurn logic by replicating it.

interface StatusEffect {
    id: string;
    name: string;
    type: 'BUFF' | 'DEBUFF';
    duration?: number;
    sourceId?: string;
    stat?: string;
    modifier?: number | string;
}

interface MockCombatant {
    id: string;
    name: string;
    statusEffects: StatusEffect[];
}

// Replicate the CURRENT processStartOfTurn logic
function currentTickLogic(actor: MockCombatant): string[] {
    const expired: string[] = [];
    actor.statusEffects = actor.statusEffects.filter(effect => {
        if (effect.duration !== undefined) {
            effect.duration--;
            if (effect.duration <= 0) {
                expired.push(effect.name);
                return false;
            }
        }
        return true;
    });
    return expired;
}

// What the CORRECT logic should be: only tick effects whose sourceId matches the actor
function correctTickLogic(actor: MockCombatant): string[] {
    const expired: string[] = [];
    actor.statusEffects = actor.statusEffects.filter(effect => {
        if (effect.duration !== undefined) {
            // Only tick down on the SOURCE combatant's turn
            const shouldTick = !effect.sourceId || effect.sourceId === actor.id;
            if (shouldTick) {
                effect.duration--;
                if (effect.duration <= 0) {
                    expired.push(effect.name);
                    return false;
                }
            }
        }
        return true;
    });
    return expired;
}

let passed = 0, failed = 0;
function assert(name: string, condition: boolean, detail: string) {
    if (condition) { console.log(`  ✅ ${name}: ${detail}`); passed++; }
    else { console.log(`  ❌ FAIL ${name}: ${detail}`); failed++; }
}

// === TEST: Current (buggy) behavior ===
console.log('\n=== CURRENT TICK LOGIC (every turn) ===');
{
    const player: MockCombatant = {
        id: 'player', name: 'Player',
        statusEffects: [{ id: 'shield', name: 'Shield', type: 'BUFF', stat: 'ac', modifier: 5, duration: 1, sourceId: 'player' }]
    };
    const ally: MockCombatant = { id: 'ally', name: 'Ally', statusEffects: [] };
    const enemy: MockCombatant = { id: 'enemy', name: 'Enemy', statusEffects: [] };

    // Turn order: Player (already acted, Shield just cast) → Ally → Enemy → Player again
    // Shield is on Player with duration=1

    // Ally's turn — processStartOfTurn ticks Player's effects? No, it ticks Ally's effects.
    // Wait — the effect is on PLAYER, not on Ally. processStartOfTurn only ticks the ACTOR's effects.
    // Let me re-read: processStartOfTurn(actor) ticks actor.statusEffects.
    // Shield is on player.statusEffects. So it only ticks when processStartOfTurn(player) is called.

    // Actually this means the current logic might be correct! Let me verify.

    // Simulate: Player's Shield is on player.statusEffects with duration=1.
    // Next round: processStartOfTurn(player) → ticks shield → 1→0 → expires.
    // That's correct for "until start of your next turn".

    // But what if we have an ENEMY buff on the PLAYER? Like a debuff with sourceId='enemy'?
    // processStartOfTurn(player) would tick it — but it should only tick on the ENEMY's turn.

    // Let's test: Enemy casts a 2-round Frightened on Player
    const player2: MockCombatant = {
        id: 'player', name: 'Player',
        statusEffects: [
            { id: 'frightened', name: 'Frightened', type: 'DEBUFF', duration: 2, sourceId: 'enemy' }
        ]
    };

    // Turn 1: Player's turn starts → current logic ticks frightened → 2→1
    let exp = currentTickLogic(player2);
    assert('Player turn 1: Frightened survives (current)', player2.statusEffects.length === 1, `effects=${player2.statusEffects.length}, dur=${player2.statusEffects[0]?.duration}`);

    // Turn 1: Ally's turn — Frightened is on Player, not Ally, so nothing happens
    // (This is already correct — each actor only ticks their OWN effects)

    // Turn 1: Enemy's turn — nothing happens to Player's effects

    // Turn 2: Player's turn starts → current logic ticks frightened → 1→0 → expires
    exp = currentTickLogic(player2);
    assert('Player turn 2: Frightened expires (current)', player2.statusEffects.length === 0, `effects=${player2.statusEffects.length}`);

    // Hmm, this means a "2 round" effect only lasts 2 of the PLAYER's turns,
    // which IS 2 rounds (if 1 round = all combatants acting once).
    // That's actually correct per D&D!
}

console.log('\n=== SHIELD DURATION TEST ===');
{
    // Shield: duration=1, cast by Player. Should expire at start of Player's NEXT turn.
    const player: MockCombatant = {
        id: 'player', name: 'Player',
        statusEffects: [{ id: 'shield', name: 'Shield', type: 'BUFF', stat: 'ac', modifier: 5, duration: 1, sourceId: 'player' }]
    };

    // Player just cast Shield. Next: processStartOfTurn is called for Player (next round).
    // Shield duration: 1 → 0 → expires.
    // That means Shield only lasts until Player's next turn — CORRECT per D&D.

    const exp = currentTickLogic(player);
    assert('Shield expires at start of next turn', exp.includes('Shield'), `expired: ${exp}`);
    assert('Shield gone from effects', player.statusEffects.length === 0, `effects=${player.statusEffects.length}`);
}

console.log('\n=== CROSS-COMBATANT EFFECT TEST ===');
{
    // What if an effect is applied to a TARGET by a DIFFERENT source?
    // E.g., Cleric casts Bless on Fighter (duration=10 rounds, sourceId='cleric')
    // The effect is on Fighter's statusEffects.
    // processStartOfTurn(Fighter) ticks it — duration goes down each time Fighter acts.
    // This means a 10-round Bless lasts 10 of Fighter's turns = 10 rounds. CORRECT.

    const fighter: MockCombatant = {
        id: 'fighter', name: 'Fighter',
        statusEffects: [{ id: 'bless', name: 'Bless', type: 'BUFF', duration: 10, sourceId: 'cleric' }]
    };

    for (let i = 0; i < 9; i++) currentTickLogic(fighter);
    assert('Bless survives 9 rounds', fighter.statusEffects.length === 1, `dur=${fighter.statusEffects[0]?.duration}`);

    currentTickLogic(fighter);
    assert('Bless expires after 10 rounds', fighter.statusEffects.length === 0, `effects=${fighter.statusEffects.length}`);
}

console.log('\n=== RAGE DURATION TEST ===');
{
    // Rage: 10 rounds (1 minute). Applied to Barbarian by Barbarian.
    // processStartOfTurn(barbarian) ticks it each turn. 10 turns = 10 rounds = 1 minute. CORRECT.

    const barb: MockCombatant = {
        id: 'barb', name: 'Barbarian',
        statusEffects: [{ id: 'rage', name: 'Rage', type: 'BUFF', duration: 10, sourceId: 'barb' }]
    };

    for (let i = 0; i < 10; i++) currentTickLogic(barb);
    assert('Rage expires after 10 rounds', barb.statusEffects.length === 0, `effects=${barb.statusEffects.length}`);
}

console.log('\n=== EFFECT ON ENEMY (applied by player) ===');
{
    // Player applies Frightened to Enemy (duration=2, sourceId='player').
    // Effect is on ENEMY's statusEffects.
    // processStartOfTurn(enemy) ticks it — 2 of Enemy's turns = 2 rounds. CORRECT.

    const enemy: MockCombatant = {
        id: 'enemy', name: 'Goblin',
        statusEffects: [{ id: 'frightened', name: 'Frightened', type: 'DEBUFF', duration: 2, sourceId: 'player' }]
    };

    currentTickLogic(enemy);
    assert('Frightened survives 1 enemy turn', enemy.statusEffects.length === 1, `dur=${enemy.statusEffects[0]?.duration}`);

    currentTickLogic(enemy);
    assert('Frightened expires after 2 enemy turns', enemy.statusEffects.length === 0, `effects=${enemy.statusEffects.length}`);
}

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
console.log('\nCONCLUSION: The current logic is CORRECT.');
console.log('Each actor ticks their OWN statusEffects at the start of THEIR turn.');
console.log('Effects on Actor X only decrement when Actor X acts — not when others act.');
console.log('This matches D&D 5e: duration in rounds = number of that creature\'s turns.');
if (failed > 0) process.exit(1);
