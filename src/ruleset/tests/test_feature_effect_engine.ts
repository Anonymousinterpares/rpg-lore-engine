import { FeatureEffectEngine, AttackContext } from '../combat/FeatureEffectEngine';
import { DataManager } from '../data/DataManager';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0, failed = 0;
function assert(name: string, condition: boolean, detail: string) {
    if (condition) { console.log(`  ✅ ${name}: ${detail}`); passed++; }
    else { console.log(`  ❌ FAIL ${name}: ${detail}`); failed++; }
}

function makePC(overrides: any = {}) {
    return {
        name: 'Test', level: 5, class: 'Fighter', subclass: undefined,
        race: 'Human', darkvision: 0,
        stats: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
        hp: { current: 40, max: 40, temp: 0 }, ac: 16,
        fightingStyle: undefined,
        featureUsages: {},
        statusEffects: [],
        spellSlots: {},
        equipmentSlots: {},
        ...overrides,
    } as any;
}

function makeContext(overrides: Partial<AttackContext> = {}): AttackContext {
    return {
        isRanged: false, isFinesseWeapon: false, isTwoHanded: false,
        hasOffhand: false, weaponType: 'melee', hasAllyNearTarget: false,
        hasAdvantage: false, wearingArmor: true,
        ...overrides,
    };
}

async function main() {
    // Load fighting styles data (skip full DataManager init which needs glob)
    const stylesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../data/features/fighting-styles.json'), 'utf8'));
    FeatureEffectEngine.loadFightingStyles(stylesData);

    // Load class data manually for crit range tests
    const classDir = path.join(__dirname, '../../../data/class');
    for (const file of fs.readdirSync(classDir).filter(f => f.endsWith('.json'))) {
        const classData = JSON.parse(fs.readFileSync(path.join(classDir, file), 'utf8'));
        (DataManager as any).classes = (DataManager as any).classes || {};
        (DataManager as any).classes[classData.name] = classData;
    }

    // ════════════════════════════════════════
    console.log('\n=== EXTRA ATTACK ===');
    {
        // Fighter levels
        const f1 = makePC({ class: 'Fighter', level: 1 });
        const f5 = makePC({ class: 'Fighter', level: 5 });
        const f11 = makePC({ class: 'Fighter', level: 11 });
        const f20 = makePC({ class: 'Fighter', level: 20 });
        const ctx = makeContext();

        assert('Fighter L1: 0 extra', FeatureEffectEngine.getAttackModifiers(f1, ctx).extraAttacks === 0, `${FeatureEffectEngine.getAttackModifiers(f1, ctx).extraAttacks}`);
        assert('Fighter L5: 1 extra', FeatureEffectEngine.getAttackModifiers(f5, ctx).extraAttacks === 1, `${FeatureEffectEngine.getAttackModifiers(f5, ctx).extraAttacks}`);
        assert('Fighter L11: 2 extra', FeatureEffectEngine.getAttackModifiers(f11, ctx).extraAttacks === 2, `${FeatureEffectEngine.getAttackModifiers(f11, ctx).extraAttacks}`);
        assert('Fighter L20: 3 extra', FeatureEffectEngine.getAttackModifiers(f20, ctx).extraAttacks === 3, `${FeatureEffectEngine.getAttackModifiers(f20, ctx).extraAttacks}`);

        // Ranger/Paladin/Monk
        const r5 = makePC({ class: 'Ranger', level: 5 });
        const p5 = makePC({ class: 'Paladin', level: 5 });
        const m5 = makePC({ class: 'Monk', level: 5 });
        const m4 = makePC({ class: 'Monk', level: 4 });
        assert('Ranger L5: 1 extra', FeatureEffectEngine.getAttackModifiers(r5, ctx).extraAttacks === 1, `${FeatureEffectEngine.getAttackModifiers(r5, ctx).extraAttacks}`);
        assert('Paladin L5: 1 extra', FeatureEffectEngine.getAttackModifiers(p5, ctx).extraAttacks === 1, `${FeatureEffectEngine.getAttackModifiers(p5, ctx).extraAttacks}`);
        assert('Monk L5: 1 extra', FeatureEffectEngine.getAttackModifiers(m5, ctx).extraAttacks === 1, `${FeatureEffectEngine.getAttackModifiers(m5, ctx).extraAttacks}`);
        assert('Monk L4: 0 extra', FeatureEffectEngine.getAttackModifiers(m4, ctx).extraAttacks === 0, `${FeatureEffectEngine.getAttackModifiers(m4, ctx).extraAttacks}`);

        // Valor Bard
        const bv6 = makePC({ class: 'Bard', subclass: 'College of Valor', level: 6 });
        const bv5 = makePC({ class: 'Bard', subclass: 'College of Valor', level: 5 });
        const bl6 = makePC({ class: 'Bard', subclass: 'College of Lore', level: 6 });
        assert('Valor Bard L6: 1 extra', FeatureEffectEngine.getAttackModifiers(bv6, ctx).extraAttacks === 1, `${FeatureEffectEngine.getAttackModifiers(bv6, ctx).extraAttacks}`);
        assert('Valor Bard L5: 0 extra', FeatureEffectEngine.getAttackModifiers(bv5, ctx).extraAttacks === 0, `${FeatureEffectEngine.getAttackModifiers(bv5, ctx).extraAttacks}`);
        assert('Lore Bard L6: 0 extra', FeatureEffectEngine.getAttackModifiers(bl6, ctx).extraAttacks === 0, `${FeatureEffectEngine.getAttackModifiers(bl6, ctx).extraAttacks}`);

        // Non-combat class
        const w5 = makePC({ class: 'Wizard', level: 5 });
        assert('Wizard L5: 0 extra', FeatureEffectEngine.getAttackModifiers(w5, ctx).extraAttacks === 0, `${FeatureEffectEngine.getAttackModifiers(w5, ctx).extraAttacks}`);
    }

    // ════════════════════════════════════════
    console.log('\n=== IMPROVED CRITICAL (via FeatureEffectEngine) ===');
    {
        const champion3 = makePC({ class: 'Fighter', subclass: 'Champion', level: 3 });
        const champion15 = makePC({ class: 'Fighter', subclass: 'Champion', level: 15 });
        const battlemaster5 = makePC({ class: 'Fighter', subclass: 'Battle Master', level: 5 });
        const noSub = makePC({ class: 'Fighter', level: 5 });
        const ctx = makeContext();

        assert('Champion L3: crit 19', FeatureEffectEngine.getAttackModifiers(champion3, ctx).critRange === 19, `${FeatureEffectEngine.getAttackModifiers(champion3, ctx).critRange}`);
        assert('Champion L15: crit 18', FeatureEffectEngine.getAttackModifiers(champion15, ctx).critRange === 18, `${FeatureEffectEngine.getAttackModifiers(champion15, ctx).critRange}`);
        assert('Battle Master: crit 20', FeatureEffectEngine.getAttackModifiers(battlemaster5, ctx).critRange === 20, `${FeatureEffectEngine.getAttackModifiers(battlemaster5, ctx).critRange}`);
        assert('No subclass: crit 20', FeatureEffectEngine.getAttackModifiers(noSub, ctx).critRange === 20, `${FeatureEffectEngine.getAttackModifiers(noSub, ctx).critRange}`);
    }

    // ════════════════════════════════════════
    console.log('\n=== SNEAK ATTACK (via FeatureEffectEngine) ===');
    {
        const rogue1 = makePC({ class: 'Rogue', level: 1 });
        const rogue10 = makePC({ class: 'Rogue', level: 10 });
        const rogue19 = makePC({ class: 'Rogue', level: 19 });
        const fighter5 = makePC({ class: 'Fighter', level: 5 });

        assert('Rogue L1: 1d6', FeatureEffectEngine.getAttackModifiers(rogue1, makeContext({ isFinesseWeapon: true, hasAdvantage: true })).sneakAttackDice === 1, '1');
        assert('Rogue L10: 5d6', FeatureEffectEngine.getAttackModifiers(rogue10, makeContext({ isFinesseWeapon: true, hasAdvantage: true })).sneakAttackDice === 5, '5');
        assert('Rogue L19: 10d6', FeatureEffectEngine.getAttackModifiers(rogue19, makeContext({ isFinesseWeapon: true, hasAdvantage: true })).sneakAttackDice === 10, '10');
        assert('Fighter: 0 dice', FeatureEffectEngine.getAttackModifiers(fighter5, makeContext({ isFinesseWeapon: true, hasAdvantage: true })).sneakAttackDice === 0, '0');

        // Eligibility
        assert('Finesse+advantage: eligible', FeatureEffectEngine.getAttackModifiers(rogue10, makeContext({ isFinesseWeapon: true, hasAdvantage: true })).sneakEligible === true, 'true');
        assert('Finesse+ally: eligible', FeatureEffectEngine.getAttackModifiers(rogue10, makeContext({ isFinesseWeapon: true, hasAllyNearTarget: true })).sneakEligible === true, 'true');
        assert('No finesse, no ranged: NOT eligible', FeatureEffectEngine.getAttackModifiers(rogue10, makeContext({ hasAdvantage: true })).sneakEligible === false, 'false');
        assert('Finesse, no adv, no ally: NOT eligible', FeatureEffectEngine.getAttackModifiers(rogue10, makeContext({ isFinesseWeapon: true })).sneakEligible === false, 'false');
        assert('Ranged+advantage: eligible', FeatureEffectEngine.getAttackModifiers(rogue10, makeContext({ isRanged: true, hasAdvantage: true })).sneakEligible === true, 'true');
    }

    // ════════════════════════════════════════
    console.log('\n=== FIGHTING STYLES ===');
    {
        // Archery: +2 attack on ranged
        const archery = makePC({ fightingStyle: 'Archery' });
        assert('Archery ranged: +2 attack', FeatureEffectEngine.getAttackModifiers(archery, makeContext({ isRanged: true })).attackBonus === 2, `${FeatureEffectEngine.getAttackModifiers(archery, makeContext({ isRanged: true })).attackBonus}`);
        assert('Archery melee: +0', FeatureEffectEngine.getAttackModifiers(archery, makeContext({ isRanged: false })).attackBonus === 0, `${FeatureEffectEngine.getAttackModifiers(archery, makeContext({ isRanged: false })).attackBonus}`);

        // Defense: +1 AC with armor
        const defense = makePC({ fightingStyle: 'Defense' });
        assert('Defense with armor: +1 AC', FeatureEffectEngine.getAttackModifiers(defense, makeContext({ wearingArmor: true })).acBonus === 1, `${FeatureEffectEngine.getAttackModifiers(defense, makeContext({ wearingArmor: true })).acBonus}`);
        assert('Defense no armor: +0 AC', FeatureEffectEngine.getAttackModifiers(defense, makeContext({ wearingArmor: false })).acBonus === 0, `${FeatureEffectEngine.getAttackModifiers(defense, makeContext({ wearingArmor: false })).acBonus}`);

        // Dueling: +2 damage melee one-hand no offhand
        const dueling = makePC({ fightingStyle: 'Dueling' });
        assert('Dueling melee no offhand: +2 dmg', FeatureEffectEngine.getAttackModifiers(dueling, makeContext({ isRanged: false, hasOffhand: false })).damageBonus === 2, `${FeatureEffectEngine.getAttackModifiers(dueling, makeContext({ isRanged: false, hasOffhand: false })).damageBonus}`);
        assert('Dueling with offhand: +0', FeatureEffectEngine.getAttackModifiers(dueling, makeContext({ isRanged: false, hasOffhand: true })).damageBonus === 0, `${FeatureEffectEngine.getAttackModifiers(dueling, makeContext({ isRanged: false, hasOffhand: true })).damageBonus}`);
        assert('Dueling ranged: +0', FeatureEffectEngine.getAttackModifiers(dueling, makeContext({ isRanged: true, hasOffhand: false })).damageBonus === 0, `${FeatureEffectEngine.getAttackModifiers(dueling, makeContext({ isRanged: true, hasOffhand: false })).damageBonus}`);

        // Great Weapon Fighting: reroll <=2 with two-handed
        const gwf = makePC({ fightingStyle: 'Great Weapon Fighting' });
        assert('GWF two-handed: reroll 2', FeatureEffectEngine.getAttackModifiers(gwf, makeContext({ isTwoHanded: true })).rerollDamageBelow === 2, `${FeatureEffectEngine.getAttackModifiers(gwf, makeContext({ isTwoHanded: true })).rerollDamageBelow}`);
        assert('GWF one-handed: no reroll', FeatureEffectEngine.getAttackModifiers(gwf, makeContext({ isTwoHanded: false })).rerollDamageBelow === 0, `${FeatureEffectEngine.getAttackModifiers(gwf, makeContext({ isTwoHanded: false })).rerollDamageBelow}`);

        // No fighting style
        const none = makePC({});
        assert('No style: all zeroes', FeatureEffectEngine.getAttackModifiers(none, makeContext()).attackBonus === 0 && FeatureEffectEngine.getAttackModifiers(none, makeContext()).damageBonus === 0, 'all zero');
    }

    // ════════════════════════════════════════
    console.log('\n=== RAGE ===');
    {
        const barb = makePC({ class: 'Barbarian', level: 5, featureUsages: { Rage: { current: 3, max: 3, usageType: 'LONG_REST' } } });

        assert('Not raging initially', FeatureEffectEngine.isRaging(barb) === false, 'false');

        // Activate rage
        const result = FeatureEffectEngine.resolveActivatedFeature(barb, 'Rage');
        assert('Rage activation succeeds', result.success === true, result.message);
        assert('Rage returns status effect', !!result.statusEffect, `${result.statusEffect?.name}`);
        assert('Rage consumes use', barb.featureUsages.Rage.current === 2, `${barb.featureUsages.Rage.current}`);

        // Apply the status effect
        barb.statusEffects.push(result.statusEffect as any);
        assert('Now raging', FeatureEffectEngine.isRaging(barb) === true, 'true');

        // Rage damage bonus in melee
        const mods = FeatureEffectEngine.getAttackModifiers(barb, makeContext({ isRanged: false }));
        assert('Rage +2 melee dmg at L5', mods.damageBonus === 2, `${mods.damageBonus}`);

        // Rage NO bonus on ranged
        const rangedMods = FeatureEffectEngine.getAttackModifiers(barb, makeContext({ isRanged: true }));
        assert('Rage +0 ranged dmg', rangedMods.damageBonus === 0, `${rangedMods.damageBonus}`);

        // Can't rage while raging
        const result2 = FeatureEffectEngine.resolveActivatedFeature(barb, 'Rage');
        assert('Cannot double-rage', result2.success === false, result2.message);

        // Rage damage scaling
        const barb16 = makePC({ class: 'Barbarian', level: 16, statusEffects: [{ id: 'rage', name: 'Rage', type: 'BUFF', duration: 10 }] });
        const mods16 = FeatureEffectEngine.getAttackModifiers(barb16, makeContext());
        assert('Rage +4 at L16', mods16.damageBonus === 4, `${mods16.damageBonus}`);
    }

    // ════════════════════════════════════════
    console.log('\n=== DIVINE SMITE ===');
    {
        const paladin = makePC({ class: 'Paladin', level: 5, spellSlots: { '1': { current: 4, max: 4 }, '2': { current: 2, max: 2 } } });

        // Level 1 smite: 2d8
        const result1 = FeatureEffectEngine.resolveActivatedFeature(paladin, 'Divine Smite', { spellSlotLevel: 1 });
        assert('Smite L1 succeeds', result1.success === true, result1.message);
        assert('Smite consumes L1 slot', paladin.spellSlots['1'].current === 3, `${paladin.spellSlots['1'].current}`);

        // Level 2 smite: 3d8
        const result2 = FeatureEffectEngine.resolveActivatedFeature(paladin, 'Divine Smite', { spellSlotLevel: 2 });
        assert('Smite L2 succeeds', result2.success === true, result2.message);
        assert('Smite consumes L2 slot', paladin.spellSlots['2'].current === 1, `${paladin.spellSlots['2'].current}`);

        // Exhaust slots
        paladin.spellSlots['1'].current = 0;
        paladin.spellSlots['2'].current = 0;
        const result3 = FeatureEffectEngine.resolveActivatedFeature(paladin, 'Divine Smite', { spellSlotLevel: 1 });
        assert('Smite fails with no slots', result3.success === false, result3.message);

        // Non-paladin can't smite
        const fighter = makePC({ class: 'Fighter', level: 5 });
        const result4 = FeatureEffectEngine.resolveActivatedFeature(fighter, 'Divine Smite');
        assert('Fighter cannot smite', result4.success === false, result4.message);
    }

    // ════════════════════════════════════════
    console.log('\n=== SECOND WIND ===');
    {
        const fighter = makePC({ class: 'Fighter', level: 5, featureUsages: { 'Second Wind': { current: 1, max: 1, usageType: 'SHORT_REST' } } });
        const result = FeatureEffectEngine.resolveActivatedFeature(fighter, 'Second Wind');
        assert('Second Wind succeeds', result.success === true, result.message);
        assert('Heals > 0', (result.healAmount ?? 0) > 0, `healed ${result.healAmount}`);
        assert('Heals at least level+1', (result.healAmount ?? 0) >= 6, `healed ${result.healAmount}`);
        assert('Consumes use', fighter.featureUsages['Second Wind'].current === 0, `${fighter.featureUsages['Second Wind'].current}`);

        // Can't use again
        const result2 = FeatureEffectEngine.resolveActivatedFeature(fighter, 'Second Wind');
        assert('Second Wind fails when exhausted', result2.success === false, result2.message);
    }

    // ════════════════════════════════════════
    console.log('\n=== LAY ON HANDS ===');
    {
        const paladin = makePC({ class: 'Paladin', level: 5 });
        // Pool = 5 * 5 = 25
        assert('Pool starts at 25', FeatureEffectEngine.getLayOnHandsPool(paladin) === 25, `${FeatureEffectEngine.getLayOnHandsPool(paladin)}`);

        const result = FeatureEffectEngine.resolveActivatedFeature(paladin, 'Lay on Hands', { healAmount: 10 });
        assert('Heals 10', result.success && result.healAmount === 10, `${result.healAmount}`);
        assert('Pool now 15', FeatureEffectEngine.getLayOnHandsPool(paladin) === 15, `${FeatureEffectEngine.getLayOnHandsPool(paladin)}`);

        // Try to overheal
        const result2 = FeatureEffectEngine.resolveActivatedFeature(paladin, 'Lay on Hands', { healAmount: 100 });
        assert('Capped at pool', result2.success && result2.healAmount === 15, `${result2.healAmount}`);
        assert('Pool now 0', FeatureEffectEngine.getLayOnHandsPool(paladin) === 0, `${FeatureEffectEngine.getLayOnHandsPool(paladin)}`);

        // Pool empty
        const result3 = FeatureEffectEngine.resolveActivatedFeature(paladin, 'Lay on Hands', { healAmount: 5 });
        assert('Fails when empty', result3.success === false, result3.message);
    }

    // ════════════════════════════════════════
    console.log('\n=== EDGE CASES ===');
    {
        // Non-existent feature
        const pc = makePC({});
        const result = FeatureEffectEngine.resolveActivatedFeature(pc, 'Nonexistent Power');
        assert('Unknown feature fails gracefully', result.success === false, result.message);

        // Fighter with Archery attacking melee (should not get bonus)
        const archerMelee = makePC({ class: 'Fighter', fightingStyle: 'Archery' });
        const mods = FeatureEffectEngine.getAttackModifiers(archerMelee, makeContext({ isRanged: false }));
        assert('Archery no bonus on melee', mods.attackBonus === 0, `${mods.attackBonus}`);

        // Champion Fighter L2 (below Improved Critical level)
        const champ2 = makePC({ class: 'Fighter', subclass: 'Champion', level: 2 });
        assert('Champion L2: normal crit', FeatureEffectEngine.getAttackModifiers(champ2, makeContext()).critRange === 20, `${FeatureEffectEngine.getAttackModifiers(champ2, makeContext()).critRange}`);

        // Rogue with no weapon (shouldn't crash)
        const rogueNaked = makePC({ class: 'Rogue', level: 5 });
        const mods2 = FeatureEffectEngine.getAttackModifiers(rogueNaked, makeContext());
        assert('Rogue naked: 0 sneak eligible', mods2.sneakEligible === false, `${mods2.sneakEligible}`);
        assert('Rogue naked: still has dice', mods2.sneakAttackDice === 3, `${mods2.sneakAttackDice}`);
    }

    console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
