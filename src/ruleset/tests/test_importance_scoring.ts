/**
 * Importance Scoring Tests — Verifies multi-signal routing
 *
 * Run: npx tsx src/ruleset/tests/test_importance_scoring.ts
 */

if (typeof localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (global as any).localStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: () => {}, clear: () => {}
    };
}

import { calculateImportanceScore } from '../combat/managers/ImportanceScoring';

function pass(msg: string) { console.log(`  \u2705 ${msg}`); }
function fail(msg: string) { console.log(`  \u274c ${msg}`); }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg); }

const baseCtx = { conversationHistory: [], worldTimeHour: 14, recentCombat: false };

const guard = {
    id: 'c0', name: 'Grimjaw Ironhelm', class: 'Fighter', role: 'Guard',
    traits: ['Stoic', 'Duty (Honor)', 'Ex-Soldier', 'Aggressive'],
    hp: { current: 25, max: 25 }, standing: 30,
    equippedWeapon: 'Longsword', equippedArmor: 'Chain Mail',
    preparedSpells: undefined, cantrips: undefined, gold: 10,
};

const scholar = {
    id: 'c1', name: 'Lyra Moonwhisper', class: 'Wizard', role: 'Scholar',
    traits: ['Inquisitive', 'Knowledge (Secrets)', 'Bookish', 'Scholar'],
    hp: { current: 18, max: 18 }, standing: 40,
    equippedWeapon: 'Quarterstaff', equippedArmor: undefined,
    preparedSpells: ['Magic Missile', 'Shield', 'Cure Wounds'], cantrips: ['Fire Bolt'], gold: 5,
};

const bandit = {
    id: 'c2', name: 'Rotgut the Vile', class: 'Rogue', role: 'Bandit',
    traits: ['Charismatic', 'Greed (Gold)', 'Escaped Convict', 'Gossip'],
    hp: { current: 20, max: 20 }, standing: 15,
    equippedWeapon: 'Shortsword', equippedArmor: 'Leather',
    preparedSpells: undefined, cantrips: undefined, gold: 30,
};

function runTests() {
    console.log('=== IMPORTANCE SCORING TESTS ===\n');

    // Test 1: Direct name address wins
    console.log('--- Test 1: Name Address ---');
    {
        const gScore = calculateImportanceScore(guard, { ...baseCtx, input: 'Grimjaw, what do you think?' }, ['c0','c1','c2']);
        const lScore = calculateImportanceScore(scholar, { ...baseCtx, input: 'Grimjaw, what do you think?' }, ['c0','c1','c2']);
        check(gScore.score > lScore.score, `Grimjaw(${gScore.score}) > Lyra(${lScore.score}) when named`);
    }

    // Test 2: Typo in name still works
    console.log('\n--- Test 2: Name Typo ---');
    {
        const gScore = calculateImportanceScore(guard, { ...baseCtx, input: 'Grmjaw, are you ready?' }, ['c0','c1','c2']);
        check(gScore.signals.includes('name(+9)'), `Typo "Grmjaw" matches Grimjaw: ${gScore.signals.join(', ')}`);
    }

    // Test 3: Magic question → Scholar wins
    console.log('\n--- Test 3: Magic Question → Scholar ---');
    {
        const gScore = calculateImportanceScore(guard, { ...baseCtx, input: 'Can anyone cast a spell to help us?' }, ['c0','c1','c2']);
        const lScore = calculateImportanceScore(scholar, { ...baseCtx, input: 'Can anyone cast a spell to help us?' }, ['c0','c1','c2']);
        check(lScore.score > gScore.score, `Lyra(${lScore.score}) > Grimjaw(${gScore.score}) on magic question`);
        console.log(`  Lyra signals: ${lScore.signals.join(', ')}`);
    }

    // Test 4: Weapon question → Guard wins (has longsword)
    console.log('\n--- Test 4: Weapon Question → Guard (has weapon) ---');
    {
        const gScore = calculateImportanceScore(guard, { ...baseCtx, input: 'Who has a sword? Are you armed?' }, ['c0','c1','c2']);
        const lScore = calculateImportanceScore(scholar, { ...baseCtx, input: 'Who has a sword? Are you armed?' }, ['c0','c1','c2']);
        check(gScore.score > lScore.score, `Grimjaw(${gScore.score}) > Lyra(${lScore.score}) on weapon question`);
    }

    // Test 5: Gold/treasure talk → Bandit wins (Greed trait)
    console.log('\n--- Test 5: Gold Talk → Bandit (Greed trait) ---');
    {
        const gScore = calculateImportanceScore(guard, { ...baseCtx, input: 'There might be gold and treasure in there' }, ['c0','c1','c2']);
        const bScore = calculateImportanceScore(bandit, { ...baseCtx, input: 'There might be gold and treasure in there' }, ['c0','c1','c2']);
        check(bScore.score > gScore.score, `Rotgut(${bScore.score}) > Grimjaw(${gScore.score}) on gold talk`);
        console.log(`  Rotgut signals: ${bScore.signals.join(', ')}`);
    }

    // Test 6: Danger/safety → Guard wins (role expertise)
    console.log('\n--- Test 6: Safety Question → Guard ---');
    {
        const gScore = calculateImportanceScore(guard, { ...baseCtx, input: 'Is it safe here? Any danger ahead?' }, ['c0','c1','c2']);
        const lScore = calculateImportanceScore(scholar, { ...baseCtx, input: 'Is it safe here? Any danger ahead?' }, ['c0','c1','c2']);
        check(gScore.score > lScore.score, `Grimjaw(${gScore.score}) > Lyra(${lScore.score}) on safety question`);
    }

    // Test 7: History/lore → Scholar wins
    console.log('\n--- Test 7: History Question → Scholar ---');
    {
        const gScore = calculateImportanceScore(guard, { ...baseCtx, input: 'What do you know about the history of these ruins?' }, ['c0','c1','c2']);
        const lScore = calculateImportanceScore(scholar, { ...baseCtx, input: 'What do you know about the history of these ruins?' }, ['c0','c1','c2']);
        check(lScore.score > gScore.score, `Lyra(${lScore.score}) > Grimjaw(${gScore.score}) on history question`);
    }

    // Test 8: "Let's flee" → Aggressive guard disagrees
    console.log('\n--- Test 8: Disagreement Seed ---');
    {
        const gScore = calculateImportanceScore(guard, { ...baseCtx, input: "Let's flee and retreat from here" }, ['c0','c1','c2']);
        check(gScore.signals.some(s => s.startsWith('disagree')), `Guard disagrees with fleeing: ${gScore.signals.join(', ')}`);
    }

    // Test 9: Recent speaker penalty
    console.log('\n--- Test 9: Recent Speaker Penalty ---');
    {
        const ctxWithHistory = {
            ...baseCtx,
            input: 'What else?',
            conversationHistory: [
                { speakerId: 'c0', speakerName: 'Grimjaw', text: 'Blah', isPrivate: false, timestamp: '' }
            ]
        };
        const gScore = calculateImportanceScore(guard, ctxWithHistory, ['c0','c1','c2']);
        check(gScore.signals.includes('recentSpoke(-3)'), `Guard penalized for recent speaking: ${gScore.signals.join(', ')}`);
    }

    // Test 10: Wounded companion asked about health
    console.log('\n--- Test 10: Wounded + Asked About Health ---');
    {
        const woundedScholar = { ...scholar, hp: { current: 3, max: 18 } };
        const sScore = calculateImportanceScore(woundedScholar, { ...baseCtx, input: 'How are you feeling? Are you hurt?' }, ['c0','c1','c2']);
        check(sScore.signals.includes('woundedAsked(+3)'), `Wounded scholar boosted when asked about health: ${sScore.signals.join(', ')}`);
    }

    // Test 11: Wounded companion NOT asked about health → dampened
    console.log('\n--- Test 11: Wounded + Generic Question → Dampened ---');
    {
        const woundedScholar = { ...scholar, hp: { current: 3, max: 18 } };
        const sScore = calculateImportanceScore(woundedScholar, { ...baseCtx, input: 'What should we do next?' }, ['c0','c1','c2']);
        check(sScore.signals.includes('wounded(-2)'), `Wounded scholar dampened on generic question: ${sScore.signals.join(', ')}`);
    }

    // Test 12: Extrovert vs introvert on neutral input
    console.log('\n--- Test 12: Extrovert vs Introvert ---');
    {
        const gScore = calculateImportanceScore(guard, { ...baseCtx, input: 'Nice weather today.' }, ['c0','c1','c2']);
        const bScore = calculateImportanceScore(bandit, { ...baseCtx, input: 'Nice weather today.' }, ['c0','c1','c2']);
        // Bandit has Charismatic+Gossip (extrovert), Guard has Stoic (introvert)
        check(bScore.score > gScore.score, `Rotgut(${bScore.score}) > Grimjaw(${gScore.score}) on neutral input (extrovert wins)`);
    }

    // Test 13: Unconscious companion blocked
    console.log('\n--- Test 13: Unconscious Block ---');
    {
        const deadGuard = { ...guard, hp: { current: 0, max: 25 } };
        const gScore = calculateImportanceScore(deadGuard, { ...baseCtx, input: 'Grimjaw, wake up!' }, ['c0','c1','c2']);
        check(gScore.score === -999, `Unconscious guard score: ${gScore.score}`);
    }

    console.log('\n=== ALL IMPORTANCE SCORING TESTS COMPLETE ===');
}

runTests();
