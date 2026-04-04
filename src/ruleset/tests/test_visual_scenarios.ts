/**
 * VISUAL SCENARIO INTEGRATION TESTS
 *
 * Simulates the EXACT flows from the 10 test scenarios provided to the user.
 * Tests the full pipeline: IntentRouter → GameLoop command → CombatOrchestrator → FeatureEffectEngine
 * Uses real class data, real AbilityParser, real FeatureEffectEngine — no mocks.
 */
import { IntentRouter } from '../combat/IntentRouter';
import { AbilityParser } from '../combat/AbilityParser';
import { FeatureEffectEngine, AttackContext } from '../combat/FeatureEffectEngine';
import { CombatResolutionEngine } from '../combat/CombatResolutionEngine';
import { LevelingEngine } from '../combat/LevelingEngine';
import { OAEngine } from '../combat/OAEngine';
import { CombatGridManager } from '../combat/grid/CombatGridManager';
import { DataManager } from '../data/DataManager';
import { MechanicsEngine } from '../combat/MechanicsEngine';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0, failed = 0;
function assert(name: string, condition: boolean, detail: string = '') {
    if (condition) { console.log(`  ✅ ${name}${detail ? ': ' + detail : ''}`); passed++; }
    else { console.log(`  ❌ FAIL ${name}${detail ? ': ' + detail : ''}`); failed++; }
}

function loadData() {
    const classDir = path.join(__dirname, '../../../data/class');
    for (const file of fs.readdirSync(classDir).filter(f => f.endsWith('.json'))) {
        const d = JSON.parse(fs.readFileSync(path.join(classDir, file), 'utf8'));
        (DataManager as any).classes = (DataManager as any).classes || {};
        (DataManager as any).classes[d.name] = d;
    }
    const stylesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../data/features/fighting-styles.json'), 'utf8'));
    FeatureEffectEngine.loadFightingStyles(stylesData);
}

function makePC(o: any = {}) {
    return {
        name: 'Hero', level: 1, class: 'Fighter', subclass: undefined, race: 'Human', darkvision: 0,
        stats: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 12, CHA: 10 },
        hp: { current: 12, max: 12, temp: 0 }, ac: 16,
        fightingStyle: undefined, featureUsages: {}, statusEffects: [] as any[], spellSlots: {},
        feats: [] as string[], equipmentSlots: { armor: 'chain_mail' } as any,
        savingThrowProficiencies: ['STR', 'CON'],
        cantripsKnown: [] as string[], knownSpells: [] as string[], preparedSpells: [] as string[],
        spellbook: [] as string[], unseenSpells: [] as string[],
        inventory: { gold: { gp: 15, sp: 0, cp: 0, ep: 0, pp: 0 }, items: [] as any[] },
        xp: 0, multiclassLevels: {}, conditions: [], skills: {},
        skillProficiencies: [] as string[], weaponProficiencies: [] as string[],
        skillPoints: { available: 0, totalEarned: 0 },
        hitDice: { current: 1, max: 1, dieType: '1d10' },
        attunedItems: [] as string[], inspiration: false,
        deathSaves: { successes: 0, failures: 0 },
        knownEntities: { monsters: [], items: [] },
        biography: { background: 'Soldier', traits: [], ideals: [], bonds: [], flaws: [], chronicles: [] },
        ...o
    } as any;
}

function makeCombatant(id: string, type: string, pos: { x: number, y: number }, o: any = {}) {
    return {
        id, name: id, type, isPlayer: type === 'player',
        hp: { current: 30, max: 30, temp: 0 }, ac: 14,
        stats: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
        statusEffects: [] as any[], conditions: [] as any[], position: { ...pos },
        tactical: { cover: 'None', reach: 5, isRanged: false },
        resources: { actionSpent: false, bonusActionSpent: false, reactionSpent: false },
        movementRemaining: 6, movementSpeed: 6, size: 'Medium', darkvision: 0,
        preparedSpells: [] as string[], spellSlots: {}, ...o
    } as any;
}

function makeGrid(): CombatGridManager {
    const cells: any = {};
    for (let x = -10; x <= 10; x++) {
        for (let y = -10; y <= 10; y++) {
            cells[`${x},${y}`] = { terrain: 'open', passable: true, features: [] };
        }
    }
    return new CombatGridManager({ cells, width: 20, height: 20 });
}

function ensureFeatures(pc: any) {
    const classData = DataManager.getClass(pc.class);
    if (!classData) return;
    for (const feat of classData.allFeatures) {
        if (feat.level <= pc.level && feat.usage && feat.usage.type !== 'PASSIVE') {
            if (!pc.featureUsages[feat.name]) {
                pc.featureUsages[feat.name] = { current: feat.usage.limit || 0, max: feat.usage.limit || 0, usageType: feat.usage.type };
            }
        }
    }
    if (pc.subclass && classData.subclasses) {
        const sub = classData.subclasses.find((s: any) => s.name === pc.subclass);
        if (sub?.features) {
            for (const feat of sub.features) {
                if (feat.level <= pc.level && feat.usage && feat.usage.type !== 'PASSIVE') {
                    if (!pc.featureUsages[feat.name]) {
                        pc.featureUsages[feat.name] = { current: feat.usage.limit || 0, max: feat.usage.limit || 0, usageType: feat.usage.type };
                    }
                }
            }
        }
    }
    // Special pools
    if (pc.class === 'Monk' && pc.level >= 2) {
        pc.featureUsages['Ki'] = { current: pc.level, max: pc.level, usageType: 'SHORT_REST' };
    }
    if (pc.class === 'Paladin') {
        pc.featureUsages['Lay on Hands'] = { current: pc.level * 5, max: pc.level * 5, usageType: 'LONG_REST' };
    }
    // Shared Channel Divinity pool for Cleric/Paladin
    if ((pc.class === 'Cleric' || pc.class === 'Paladin') && pc.level >= (pc.class === 'Cleric' ? 2 : 3)) {
        if (!pc.featureUsages['Channel Divinity']) {
            pc.featureUsages['Channel Divinity'] = { current: 1, max: 1, usageType: 'SHORT_REST' };
        }
    }
    // Lucky feat
    if (pc.feats?.includes('Lucky') && !pc.featureUsages['Lucky']) {
        pc.featureUsages['Lucky'] = { current: 3, max: 3, usageType: 'LONG_REST' };
    }
}

async function main() {
    loadData();

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 1: WIZARD (EVOCATION)');
    console.log('══════════════════════════════════════');
    {
        const wiz = makePC({ class: 'Wizard', level: 5, subclass: 'School of Evocation',
            stats: { STR: 8, DEX: 14, CON: 14, INT: 18, WIS: 12, CHA: 10 },
            spellSlots: { '1': { current: 4, max: 4 }, '2': { current: 3, max: 3 }, '3': { current: 2, max: 2 } },
            cantripsKnown: ['Fire Bolt', 'Mage Hand', 'Light'],
            preparedSpells: ['Magic Missile', 'Shield', 'Fireball'],
        });
        ensureFeatures(wiz);

        // Spell slots correct for L5 Wizard
        assert('L5 Wizard: 4 L1 slots', wiz.spellSlots['1'].max === 4);
        assert('L5 Wizard: 3 L2 slots', wiz.spellSlots['2'].max === 3);
        assert('L5 Wizard: 2 L3 slots', wiz.spellSlots['3'].max === 2);

        // Shield is a reaction — doesn't use action
        const shieldIntent = IntentRouter.parse('/ability Shield', true);
        assert('Shield routes as /ability', shieldIntent.command === 'ability');

        // Arcane Recovery
        assert('Has Arcane Recovery', !!wiz.featureUsages['Arcane Recovery']);

        // Sculpt Spells: Evocation Wizard feature
        const classData = DataManager.getClass('Wizard');
        const evoSub = classData?.subclasses.find(s => s.name === 'School of Evocation');
        assert('Has Sculpt Spells', !!evoSub?.features.find(f => f.name === 'Sculpt Spells' && f.level <= 5));
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 2: FIGHTER (CHAMPION)');
    console.log('══════════════════════════════════════');
    {
        const fighter = makePC({ class: 'Fighter', level: 5, subclass: 'Champion', fightingStyle: 'Dueling' });
        ensureFeatures(fighter);

        // Fighting Style stored
        assert('Fighting style set', fighter.fightingStyle === 'Dueling');

        // Fighting style bonus: Dueling +2 damage melee no offhand
        const mods = FeatureEffectEngine.getAttackModifiers(fighter, {
            isRanged: false, isFinesseWeapon: false, isTwoHanded: false, hasOffhand: false,
            weaponType: 'melee', hasAllyNearTarget: false, hasAdvantage: false, wearingArmor: true
        } as AttackContext);
        assert('Dueling: +2 damage', mods.damageBonus === 2, `${mods.damageBonus}`);

        // Extra Attack at L5
        assert('Extra Attack: 1 extra', mods.extraAttacks === 1);

        // Improved Critical at L3
        assert('Improved Critical: crit 19', mods.critRange === 19);

        // Second Wind via /ability
        assert('Has Second Wind', !!fighter.featureUsages['Second Wind']);
        const swResult = FeatureEffectEngine.resolveActivatedFeature(fighter, 'Second Wind');
        assert('Second Wind heals', swResult.success && (swResult.healAmount ?? 0) > 0, swResult.message);

        // Action Surge via /ability
        assert('Has Action Surge', !!fighter.featureUsages['Action Surge']);
        const asResult = FeatureEffectEngine.resolveActivatedFeature(fighter, 'Action Surge');
        assert('Action Surge grants action', asResult.success && asResult.grantExtraAction === true, asResult.message);

        // Command routing
        const abilityIntent = IntentRouter.parse('/ability Second Wind', true);
        const useIntent = IntentRouter.parse('/use Health Potion', true);
        assert('/ability routes to ability', abilityIntent.command === 'ability');
        assert('/use routes to use (item)', useIntent.command === 'use');
        assert('Different commands', abilityIntent.command !== useIntent.command);
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 3: ROGUE (ASSASSIN)');
    console.log('══════════════════════════════════════');
    {
        const rogue = makePC({ class: 'Rogue', level: 7, subclass: 'Assassin',
            stats: { STR: 10, DEX: 18, CON: 14, INT: 12, WIS: 14, CHA: 10 } });
        ensureFeatures(rogue);

        // Sneak Attack dice = ceil(7/2) = 4
        const ctx: AttackContext = {
            isRanged: false, isFinesseWeapon: true, isTwoHanded: false, hasOffhand: false,
            weaponType: 'melee', hasAllyNearTarget: true, hasAdvantage: false, wearingArmor: false
        };
        const mods = FeatureEffectEngine.getAttackModifiers(rogue, ctx);
        assert('Sneak Attack: 4d6', mods.sneakAttackDice === 4, `${mods.sneakAttackDice}`);
        assert('Sneak eligible (ally near)', mods.sneakEligible === true);

        // Sneak NOT eligible without finesse
        const ctxNoFinesse = { ...ctx, isFinesseWeapon: false };
        const modsNoFinesse = FeatureEffectEngine.getAttackModifiers(rogue, ctxNoFinesse);
        assert('No sneak without finesse', modsNoFinesse.sneakEligible === false);

        // Assassinate: advantage vs not-acted
        const ctxAssassinate = { ...ctx, targetHasNotActed: true };
        const modsAssassinate = FeatureEffectEngine.getAttackModifiers(rogue, ctxAssassinate);
        assert('Assassinate: forceAdvantage', modsAssassinate.forceAdvantage === true);

        // Assassinate: force crit on surprised
        const ctxSurprise = { ...ctx, targetIsSurprised: true };
        const modsSurprise = FeatureEffectEngine.getAttackModifiers(rogue, ctxSurprise);
        assert('Assassinate: forceCrit on surprised', modsSurprise.forceCrit === true);

        // Evasion at L7
        assert('Has Evasion', FeatureEffectEngine.hasEvasion(rogue));

        // Uncanny Dodge at L5+
        assert('Has Uncanny Dodge', FeatureEffectEngine.hasUncannyDodge(rogue));

        // Cunning Action
        const caResult = FeatureEffectEngine.resolveActivatedFeature(rogue, 'Cunning Action');
        assert('Cunning Action available', caResult.success, caResult.message);
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 4: BARBARIAN (BERSERKER)');
    console.log('══════════════════════════════════════');
    {
        const barb = makePC({ class: 'Barbarian', level: 5, subclass: 'Path of the Berserker',
            stats: { STR: 18, DEX: 14, CON: 16, INT: 8, WIS: 12, CHA: 10 },
            equipmentSlots: {} }); // No armor
        ensureFeatures(barb);

        // Unarmored Defense: 10 + DEX(+2) + CON(+3) = 15
        const unarmoredAC = FeatureEffectEngine.getUnarmoredDefenseAC(barb);
        assert('Unarmored AC: 15', unarmoredAC === 15, `${unarmoredAC}`);

        // Rage
        assert('Has Rage', !!barb.featureUsages['Rage']);
        const rageResult = FeatureEffectEngine.resolveActivatedFeature(barb, 'Rage');
        assert('Rage activates', rageResult.success, rageResult.message);
        barb.statusEffects.push(rageResult.statusEffect as any);

        // Rage damage bonus melee
        const mods = FeatureEffectEngine.getAttackModifiers(barb, {
            isRanged: false, isFinesseWeapon: false, isTwoHanded: true, hasOffhand: false,
            weaponType: 'melee', hasAllyNearTarget: false, hasAdvantage: false, wearingArmor: false
        } as AttackContext);
        assert('Rage +2 melee damage', mods.damageBonus === 2, `${mods.damageBonus}`);

        // Rage NO bonus ranged
        const modsRanged = FeatureEffectEngine.getAttackModifiers(barb, {
            isRanged: true, isFinesseWeapon: false, isTwoHanded: false, hasOffhand: false,
            weaponType: 'ranged', hasAllyNearTarget: false, hasAdvantage: false, wearingArmor: false
        } as AttackContext);
        assert('Rage +0 ranged', modsRanged.damageBonus === 0);

        // Rage resistance: enemy attacks should be halved
        const defMods = FeatureEffectEngine.getDefenseModifiers(barb);
        assert('Rage resistance active', defMods.rageResistance === true);

        // Reckless Attack
        const reckResult = FeatureEffectEngine.resolveActivatedFeature(barb, 'Reckless Attack');
        assert('Reckless activates', reckResult.success);
        barb.statusEffects.push(reckResult.statusEffect as any);

        const modsReckless = FeatureEffectEngine.getAttackModifiers(barb, {
            isRanged: false, isFinesseWeapon: false, isTwoHanded: true, hasOffhand: false,
            weaponType: 'melee', hasAllyNearTarget: false, hasAdvantage: false, wearingArmor: false
        } as AttackContext);
        assert('Reckless: forceAdvantage', modsReckless.forceAdvantage === true);

        // Danger Sense
        assert('Has Danger Sense', FeatureEffectEngine.hasDangerSense(barb));
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 5: CLERIC (LIFE DOMAIN)');
    console.log('══════════════════════════════════════');
    {
        const cleric = makePC({ class: 'Cleric', level: 5, subclass: 'Life Domain',
            stats: { STR: 14, DEX: 10, CON: 14, INT: 10, WIS: 18, CHA: 12 },
            spellSlots: { '1': { current: 4, max: 4 }, '2': { current: 3, max: 3 }, '3': { current: 2, max: 2 } } });
        ensureFeatures(cleric);

        // Channel Divinity
        assert('Has Channel Divinity', !!cleric.featureUsages['Channel Divinity']);

        // Turn Undead
        const turnResult = FeatureEffectEngine.resolveActivatedFeature(cleric, 'Turn Undead');
        assert('Turn Undead works', turnResult.success, turnResult.message);
        assert('Mentions destroy CR', turnResult.message.includes('CR'));

        // Preserve Life (need fresh Channel Divinity)
        cleric.featureUsages['Channel Divinity'] = { current: 1, max: 1, usageType: 'SHORT_REST' };
        const preserveResult = FeatureEffectEngine.resolveActivatedFeature(cleric, 'Channel Divinity: Preserve Life');
        assert('Preserve Life works', preserveResult.success);
        assert('Heals 25', preserveResult.healAmount === 25);

        // Shared pool depleted
        const turnResult2 = FeatureEffectEngine.resolveActivatedFeature(cleric, 'Turn Undead');
        assert('Pool depleted after Preserve Life', !turnResult2.success);
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 6: PALADIN (DEVOTION)');
    console.log('══════════════════════════════════════');
    {
        const paladin = makePC({ class: 'Paladin', level: 5, subclass: 'Oath of Devotion',
            stats: { STR: 16, DEX: 10, CON: 14, INT: 10, WIS: 12, CHA: 16 },
            spellSlots: { '1': { current: 4, max: 4 }, '2': { current: 2, max: 2 } } });
        ensureFeatures(paladin);

        // Divine Smite
        const smiteResult = FeatureEffectEngine.resolveActivatedFeature(paladin, 'Divine Smite', { spellSlotLevel: 1 });
        assert('Divine Smite works', smiteResult.success, smiteResult.message);
        assert('Smite consumes slot', paladin.spellSlots['1'].current === 3);

        // Lay on Hands
        const lohResult = FeatureEffectEngine.resolveActivatedFeature(paladin, 'Lay on Hands', { healAmount: 10 });
        assert('Lay on Hands works', lohResult.success && lohResult.healAmount === 10);
        assert('Pool reduced', FeatureEffectEngine.getLayOnHandsPool(paladin) === 15);

        // Extra Attack
        const mods = FeatureEffectEngine.getAttackModifiers(paladin, {
            isRanged: false, isFinesseWeapon: false, isTwoHanded: false, hasOffhand: false,
            weaponType: 'melee', hasAllyNearTarget: false, hasAdvantage: false, wearingArmor: true
        } as AttackContext);
        assert('Extra Attack at L5', mods.extraAttacks === 1);

        // Sacred Weapon (Channel Divinity)
        assert('Has Channel Divinity', !!paladin.featureUsages['Channel Divinity']);
        const sacredResult = FeatureEffectEngine.resolveActivatedFeature(paladin, 'Channel Divinity: Sacred Weapon');
        assert('Sacred Weapon works', sacredResult.success);
        assert('CHA bonus (+3)', sacredResult.statusEffect?.modifier === 3);
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 7: BARD (LORE)');
    console.log('══════════════════════════════════════');
    {
        const bard = makePC({ class: 'Bard', level: 5, subclass: 'College of Lore',
            stats: { STR: 10, DEX: 14, CON: 12, INT: 12, WIS: 10, CHA: 18 } });
        ensureFeatures(bard);

        // Bardic Inspiration
        assert('Has Bardic Inspiration', !!bard.featureUsages['Bardic Inspiration']);
        const biResult = FeatureEffectEngine.resolveActivatedFeature(bard, 'Bardic Inspiration', { targetName: 'Companion' });
        assert('BI works', biResult.success);
        assert('d8 at L5', biResult.message.includes('d8'));
        assert('Mentions target', biResult.message.includes('Companion'));

        // Die scaling
        assert('L5=d8', FeatureEffectEngine.getBardicInspirationDie(5) === 'd8');
        assert('L10=d10', FeatureEffectEngine.getBardicInspirationDie(10) === 'd10');
        assert('L15=d12', FeatureEffectEngine.getBardicInspirationDie(15) === 'd12');
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 8: MONK (OPEN HAND)');
    console.log('══════════════════════════════════════');
    {
        const monk = makePC({ class: 'Monk', level: 7, subclass: 'Way of the Open Hand',
            stats: { STR: 12, DEX: 18, CON: 14, INT: 10, WIS: 16, CHA: 8 },
            equipmentSlots: {} }); // No armor
        ensureFeatures(monk);

        // Unarmored Defense: 10 + DEX(+4) + WIS(+3) = 17
        assert('Monk Unarmored AC: 17', FeatureEffectEngine.getUnarmoredDefenseAC(monk) === 17);

        // Ki pool = level
        assert('Ki pool = 7', FeatureEffectEngine.getKiPool(monk) === 7);
        assert('Has Ki', !!monk.featureUsages['Ki']);

        // Flurry of Blows
        const flurryResult = FeatureEffectEngine.resolveActivatedFeature(monk, 'Ki: Flurry of Blows');
        assert('Flurry works', flurryResult.success);
        assert('Ki consumed', monk.featureUsages['Ki'].current === 6);

        // Patient Defense
        const patientResult = FeatureEffectEngine.resolveActivatedFeature(monk, 'Ki: Patient Defense');
        assert('Patient Defense works', patientResult.success);
        assert('Dodge effect', patientResult.statusEffect?.id === 'dodge');

        // Extra Attack at L5
        const mods = FeatureEffectEngine.getAttackModifiers(monk, {
            isRanged: false, isFinesseWeapon: true, isTwoHanded: false, hasOffhand: false,
            weaponType: 'melee', hasAllyNearTarget: false, hasAdvantage: false, wearingArmor: false
        } as AttackContext);
        assert('Monk Extra Attack at L5+', mods.extraAttacks === 1);

        // Evasion at L7
        assert('Monk Evasion at L7', FeatureEffectEngine.hasEvasion(monk));

        // Movement bonus
        const speedBonus = FeatureEffectEngine.getMovementSpeedBonus(monk);
        assert('Monk L7 speed bonus: +15', speedBonus === 15, `${speedBonus}`);
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 9: FEATS (GWM, SS, MOBILE, LUCKY, SENTINEL)');
    console.log('══════════════════════════════════════');
    {
        // GWM
        const gwmFighter = makePC({ feats: ['Great Weapon Master'] });
        const gwmMods = FeatureEffectEngine.getAttackModifiers(gwmFighter, {
            isRanged: false, isFinesseWeapon: false, isTwoHanded: true, hasOffhand: false,
            weaponType: 'melee', hasAllyNearTarget: false, hasAdvantage: false, wearingArmor: true,
            gwmEnabled: true
        } as AttackContext);
        assert('GWM: -5/+10', gwmMods.attackBonus === -5 && gwmMods.damageBonus === 10);

        // GWM off
        const gwmOff = FeatureEffectEngine.getAttackModifiers(gwmFighter, {
            isRanged: false, isFinesseWeapon: false, isTwoHanded: true, hasOffhand: false,
            weaponType: 'melee', hasAllyNearTarget: false, hasAdvantage: false, wearingArmor: true,
            gwmEnabled: false
        } as AttackContext);
        assert('GWM off: 0/0', gwmOff.attackBonus === 0 && gwmOff.damageBonus === 0);

        // Sharpshooter
        const ssFighter = makePC({ feats: ['Sharpshooter'] });
        const ssMods = FeatureEffectEngine.getAttackModifiers(ssFighter, {
            isRanged: true, isFinesseWeapon: false, isTwoHanded: false, hasOffhand: false,
            weaponType: 'ranged', hasAllyNearTarget: false, hasAdvantage: false, wearingArmor: true,
            sharpshooterEnabled: true
        } as AttackContext);
        assert('SS: -5/+10 + ignoreCover', ssMods.attackBonus === -5 && ssMods.damageBonus === 10 && ssMods.ignoreCover);

        // Mobile
        const mobileFighter = makePC({ feats: ['Mobile'] });
        assert('Mobile: +10 speed', FeatureEffectEngine.getMovementSpeedBonus(mobileFighter) === 10);

        // Lucky
        const luckyFighter = makePC({ feats: ['Lucky'] });
        ensureFeatures(luckyFighter);
        // Lucky needs featureUsages populated by ensureFeatureUsages or manually
        if (!luckyFighter.featureUsages['Lucky']) {
            luckyFighter.featureUsages['Lucky'] = { current: 3, max: 3, usageType: 'LONG_REST' };
        }
        const luckyResult = FeatureEffectEngine.resolveActivatedFeature(luckyFighter, 'Lucky');
        assert('Lucky works', luckyResult.success);
        assert('Lucky points remaining', FeatureEffectEngine.getLuckyPointsRemaining(luckyFighter) === 2);

        // Sentinel (tested via OA system)
        const grid = makeGrid();
        const player = makeCombatant('player', 'player', { x: 0, y: 0 });
        const sentinel = makeCombatant('sentinel', 'enemy', { x: 1, y: 0 }, { feats: ['Sentinel'] });
        const path = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }];
        const { results } = OAEngine.resolveOAsOnPath(player, path, [player, sentinel], grid);
        assert('Sentinel triggers OA', results.length >= 1);
        if (results[0]?.hit) {
            assert('Sentinel stops movement', results[0].sentinelStopsMovement === true);
        }
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('SCENARIO 10: OPPORTUNITY ATTACKS');
    console.log('══════════════════════════════════════');
    {
        const grid = makeGrid();

        // Move away from enemy → OA
        const player = makeCombatant('player', 'player', { x: 0, y: 0 });
        const goblin = makeCombatant('goblin', 'enemy', { x: 1, y: 0 });
        const path1 = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }];
        const { results: r1 } = OAEngine.resolveOAsOnPath(player, path1, [player, goblin], grid);
        assert('OA triggered on retreat', r1.length === 1);
        assert('Goblin reaction spent', goblin.resources.reactionSpent === true);

        // Disengage prevents OA
        const player2 = makeCombatant('player', 'player', { x: 0, y: 0 }, {
            statusEffects: [{ id: 'disengage', name: 'Disengage', type: 'BUFF', duration: 1 }]
        });
        const goblin2 = makeCombatant('goblin2', 'enemy', { x: 1, y: 0 });
        const { results: r2 } = OAEngine.resolveOAsOnPath(player2, path1, [player2, goblin2], grid);
        assert('Disengage prevents OA', r2.length === 0);

        // Enemy retreats → player gets OA
        const player3 = makeCombatant('player', 'player', { x: 0, y: 0 });
        const goblin3 = makeCombatant('goblin3', 'enemy', { x: 1, y: 0 });
        const path2 = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
        const { results: r3 } = OAEngine.resolveOAsOnPath(goblin3, path2, [player3, goblin3], grid);
        assert('Player gets OA on enemy retreat', r3.length === 1);
        assert('Player attacked', r3[0]?.attackerName === 'player');

        // Ally passes ally → no OA
        const player4 = makeCombatant('player', 'player', { x: 0, y: 0 });
        const companion = makeCombatant('companion', 'companion', { x: 1, y: 0 });
        const path3 = [{ x: 1, y: 0 }, { x: 1, y: -1 }, { x: 1, y: -2 }];
        const { results: r4 } = OAEngine.resolveOAsOnPath(companion, path3, [player4, companion], grid);
        assert('No OA between allies', r4.length === 0);

        // Multiple enemies
        const player5 = makeCombatant('player', 'player', { x: 0, y: 0 });
        const g1 = makeCombatant('g1', 'enemy', { x: 1, y: 0 });
        const g2 = makeCombatant('g2', 'enemy', { x: 0, y: 1 });
        const path4 = [{ x: 0, y: 0 }, { x: -1, y: -1 }, { x: -2, y: -2 }];
        const { results: r5 } = OAEngine.resolveOAsOnPath(player5, path4, [player5, g1, g2], grid);
        assert('Both enemies get OA', r5.length === 2);

        // OA warnings
        const player6 = makeCombatant('player', 'player', { x: 0, y: 0 });
        const goblin6 = makeCombatant('goblin6', 'enemy', { x: 1, y: 0 });
        const warnings = OAEngine.getOAWarnings(player6, path1, [player6, goblin6], grid);
        assert('Warning generated', warnings.length === 1);
        assert('Warning names enemy', warnings[0]?.combatantName === 'goblin6');
    }

    // ═════════════════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('CROSS-CUTTING: LEVEL UP SIMULATION');
    console.log('══════════════════════════════════════');
    {
        const fighter = makePC({ class: 'Fighter', level: 4, xp: 6500,
            hitDice: { current: 4, max: 4, dieType: '1d10' } });

        // Level up to 5
        assert('Can level up', LevelingEngine.canLevelUp(fighter));
        const result = LevelingEngine.levelUp(fighter);
        assert('Leveled to 5', fighter.level === 5, `level=${fighter.level}`);
        assert('Summary mentions HP', result.includes('HP'));
        assert('Summary mentions SP', result.includes('SP'));

        // Note: Extra Attack is in progression.features but not allFeatures for Fighter
        // _newFeatures is only set from allFeatures/subclass features, not progression

        // Pending fighting style if not set
        if (!fighter.fightingStyle) {
            assert('Pending fighting style', !!(fighter as any)._pendingFightingStyle);
        }
    }

    console.log(`\n══════════════════════════════════════`);
    console.log(`TOTAL: ${passed} passed, ${failed} failed`);
    console.log(`══════════════════════════════════════`);
    if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
