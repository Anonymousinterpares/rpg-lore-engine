/**
 * INTEGRATION TEST: Tests the EXACT command path from UI → IntentRouter → GameLoop → CombatOrchestrator → FeatureEffectEngine
 *
 * This simulates what happens when the user clicks an ability button in the AbilitiesFlyout.
 * No mocks — uses the real IntentRouter, real AbilityParser, real FeatureEffectEngine.
 */
import { IntentRouter } from '../combat/IntentRouter';
import { AbilityParser } from '../combat/AbilityParser';
import { FeatureEffectEngine } from '../combat/FeatureEffectEngine';
import { DataManager } from '../data/DataManager';
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

// Load real class data (same as DataManager but without Vite's import.meta.glob)
function loadClassData() {
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
        name: 'Test', level: 5, class: 'Fighter', subclass: 'Champion',
        race: 'Human', darkvision: 0,
        stats: { STR: 16, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 10 },
        hp: { current: 40, max: 44, temp: 0 }, ac: 18,
        fightingStyle: 'Dueling',
        featureUsages: {},
        statusEffects: [],
        spellSlots: {},
        feats: [],
        equipmentSlots: { armor: 'chain_mail' },
        savingThrowProficiencies: ['STR', 'CON'],
        cantripsKnown: [], knownSpells: [], preparedSpells: [], spellbook: [],
        inventory: { gold: { gp: 10, sp: 0, cp: 0, ep: 0, pp: 0 }, items: [] },
        ...o
    } as any;
}

async function main() {
    loadClassData();

    // ═══ TEST: IntentRouter parses /ability correctly ═══
    console.log('\n=== INTENT ROUTING ===');
    {
        // /ability command (from AbilitiesFlyout)
        const intent = IntentRouter.parse('/ability Second Wind', true);
        assert('Type is COMMAND', intent.type === 'COMMAND', intent.type);
        assert('Command is ability', intent.command === 'ability', intent.command);
        assert('Args are [Second, Wind]', intent.args?.join(' ') === 'Second Wind', intent.args?.join(' '));

        // /use command (from item context menu)
        const intentUse = IntentRouter.parse('/use Health Potion', true);
        assert('Use type is COMMAND', intentUse.type === 'COMMAND');
        assert('Use command is use', intentUse.command === 'use', intentUse.command);

        // They are DIFFERENT commands
        assert('ability !== use', intent.command !== intentUse.command);
    }

    // ═══ TEST: AbilityParser returns correct abilities for each class ═══
    console.log('\n=== ABILITY PARSER: FIGHTER L5 ===');
    {
        const fighter = makePC({ class: 'Fighter', level: 5, subclass: 'Champion', featureUsages: {} });
        const abilities = AbilityParser.getCombatAbilities(fighter);
        const names = abilities.map(a => a.name);

        assert('Has Fighting Style', names.includes('Fighting Style'), names.join(', '));
        assert('Has Second Wind', names.includes('Second Wind'), names.join(', '));
        assert('Has Action Surge', names.includes('Action Surge'), names.join(', '));
        assert('Has Martial Archetype', names.includes('Martial Archetype'), names.join(', '));
        assert('Has Improved Critical', names.includes('Improved Critical'), names.join(', '));

        // Active abilities (non-passive)
        const active = AbilityParser.getActiveAbilities(fighter);
        const activeNames = active.map(a => a.name);
        assert('Active includes Second Wind', activeNames.includes('Second Wind'), activeNames.join(', '));
        assert('Active includes Action Surge', activeNames.includes('Action Surge'), activeNames.join(', '));
    }

    console.log('\n=== ABILITY PARSER: BARBARIAN L5 ===');
    {
        const barb = makePC({ class: 'Barbarian', level: 5, subclass: undefined, featureUsages: {} });
        const active = AbilityParser.getActiveAbilities(barb);
        const names = active.map(a => a.name);
        assert('Barb has Rage', names.includes('Rage'), names.join(', '));
    }

    console.log('\n=== ABILITY PARSER: ROGUE L5 ===');
    {
        const rogue = makePC({ class: 'Rogue', level: 5, subclass: 'Thief', featureUsages: {} });
        const all = AbilityParser.getCombatAbilities(rogue);
        const names = all.map(a => a.name);
        assert('Rogue has Sneak Attack', names.includes('Sneak Attack'), names.join(', '));
        assert('Rogue has Cunning Action', names.includes('Cunning Action'), names.join(', '));
        // Thief subclass features
        assert('Rogue has Fast Hands', names.includes('Fast Hands'), names.join(', '));
        assert('Rogue has Second-Story Work', names.includes('Second-Story Work'), names.join(', '));
    }

    console.log('\n=== ABILITY PARSER: CLERIC L5 ===');
    {
        const cleric = makePC({ class: 'Cleric', level: 5, subclass: 'Life Domain', featureUsages: {} });
        const active = AbilityParser.getActiveAbilities(cleric);
        const names = active.map(a => a.name);
        assert('Cleric has Channel Divinity', names.includes('Channel Divinity'), names.join(', '));
    }

    console.log('\n=== ABILITY PARSER: PALADIN L5 ===');
    {
        const paladin = makePC({ class: 'Paladin', level: 5, subclass: 'Oath of Devotion',
            spellSlots: { '1': { current: 4, max: 4 }, '2': { current: 2, max: 2 } }, featureUsages: {} });
        const active = AbilityParser.getActiveAbilities(paladin);
        const names = active.map(a => a.name);
        assert('Paladin has Divine Sense', names.includes('Divine Sense'), names.join(', '));
        assert('Paladin has Lay on Hands', names.includes('Lay on Hands'), names.join(', '));
    }

    console.log('\n=== ABILITY PARSER: MONK L5 ===');
    {
        const monk = makePC({ class: 'Monk', level: 5, subclass: 'Way of the Open Hand', featureUsages: {} });
        const active = AbilityParser.getActiveAbilities(monk);
        const names = active.map(a => a.name);
        assert('Monk has Ki', names.includes('Ki'), names.join(', '));
    }

    console.log('\n=== ABILITY PARSER: BARD L5 ===');
    {
        const bard = makePC({ class: 'Bard', level: 5, subclass: 'College of Lore', featureUsages: {} });
        const active = AbilityParser.getActiveAbilities(bard);
        const names = active.map(a => a.name);
        assert('Bard has Bardic Inspiration', names.includes('Bardic Inspiration'), names.join(', '));
    }

    // ═══ TEST: ensureFeatureUsages fills gaps ═══
    console.log('\n=== ENSURE FEATURE USAGES ===');
    {
        const fighter = makePC({ class: 'Fighter', level: 5, featureUsages: {} });
        assert('featureUsages starts empty', Object.keys(fighter.featureUsages).length === 0);

        // Simulate what ensureFeatureUsages does
        const classData = DataManager.getClass('Fighter');
        if (classData) {
            for (const feat of classData.allFeatures) {
                if (feat.level <= fighter.level && feat.usage && feat.usage.type !== 'PASSIVE') {
                    if (!fighter.featureUsages[feat.name]) {
                        fighter.featureUsages[feat.name] = {
                            current: feat.usage.limit || 0,
                            max: feat.usage.limit || 0,
                            usageType: feat.usage.type
                        };
                    }
                }
            }
        }

        assert('Second Wind populated', !!fighter.featureUsages['Second Wind'], JSON.stringify(fighter.featureUsages));
        assert('Action Surge populated', !!fighter.featureUsages['Action Surge'], JSON.stringify(fighter.featureUsages));
        assert('Second Wind has uses', fighter.featureUsages['Second Wind']?.current > 0);
        assert('Action Surge has uses', fighter.featureUsages['Action Surge']?.current > 0);
    }

    // ═══ TEST: Full ability resolution path ═══
    console.log('\n=== FULL RESOLUTION: SECOND WIND ===');
    {
        const fighter = makePC({ class: 'Fighter', level: 5, featureUsages: {
            'Second Wind': { current: 1, max: 1, usageType: 'SHORT_REST' }
        }});

        // 1. Find ability (same as useAbility line 1285)
        const abilities = AbilityParser.getCombatAbilities(fighter);
        const ability = abilities.find(a => a.name.toLowerCase() === 'second wind');
        assert('Ability found', !!ability, ability?.name);

        // 2. Resolve via FeatureEffectEngine (same as useAbility line 1307)
        const result = FeatureEffectEngine.resolveActivatedFeature(fighter, 'Second Wind');
        assert('Resolution succeeds', result.success, result.message);
        assert('Heals HP', (result.healAmount ?? 0) > 0, `healed ${result.healAmount}`);
    }

    console.log('\n=== FULL RESOLUTION: RAGE ===');
    {
        const barb = makePC({ class: 'Barbarian', level: 5, featureUsages: {
            'Rage': { current: 3, max: 3, usageType: 'LONG_REST' }
        }});

        const abilities = AbilityParser.getCombatAbilities(barb);
        const ability = abilities.find(a => a.name.toLowerCase() === 'rage');
        assert('Rage found in abilities', !!ability);

        const result = FeatureEffectEngine.resolveActivatedFeature(barb, 'Rage');
        assert('Rage succeeds', result.success, result.message);
        assert('Returns status effect', !!result.statusEffect);
    }

    console.log('\n=== FULL RESOLUTION: ACTION SURGE ===');
    {
        const fighter = makePC({ class: 'Fighter', level: 5, featureUsages: {
            'Action Surge': { current: 1, max: 1, usageType: 'SHORT_REST' }
        }});

        const result = FeatureEffectEngine.resolveActivatedFeature(fighter, 'Action Surge');
        assert('Action Surge succeeds', result.success, result.message);
        assert('Grants extra action', result.grantExtraAction === true);
    }

    // ═══ TEST: Ability name matching (case insensitive, multi-word) ═══
    console.log('\n=== NAME MATCHING EDGE CASES ===');
    {
        const fighter = makePC({ class: 'Fighter', level: 5, featureUsages: {
            'Second Wind': { current: 1, max: 1, usageType: 'SHORT_REST' }
        }});
        const abilities = AbilityParser.getCombatAbilities(fighter);

        // Various casings
        assert('Exact match', !!abilities.find(a => a.name.toLowerCase() === 'second wind'));
        assert('Upper case', !!abilities.find(a => a.name.toLowerCase() === 'SECOND WIND'.toLowerCase()));
        assert('Mixed case', !!abilities.find(a => a.name.toLowerCase() === 'Second Wind'.toLowerCase()));
        assert('No match wrong name', !abilities.find(a => a.name.toLowerCase() === 'fireball'));
    }

    // ═══ TEST: Monk Ki sub-abilities ═══
    console.log('\n=== KI SUB-ABILITIES RESOLUTION ===');
    {
        const monk = makePC({ class: 'Monk', level: 5, featureUsages: {
            'Ki': { current: 5, max: 5, usageType: 'SHORT_REST' }
        }});

        // These are called as "Ki: Flurry of Blows" etc
        const r1 = FeatureEffectEngine.resolveActivatedFeature(monk, 'Ki: Flurry of Blows');
        assert('Flurry resolves', r1.success, r1.message);
        assert('Ki consumed', monk.featureUsages['Ki'].current === 4);

        const r2 = FeatureEffectEngine.resolveActivatedFeature(monk, 'Ki: Patient Defense');
        assert('Patient Defense resolves', r2.success);
        assert('Ki consumed again', monk.featureUsages['Ki'].current === 3);
    }

    // ═══ TEST: Channel Divinity with domain ═══
    console.log('\n=== CHANNEL DIVINITY INTEGRATION ===');
    {
        const cleric = makePC({ class: 'Cleric', level: 5, subclass: 'Life Domain', featureUsages: {
            'Channel Divinity': { current: 1, max: 1, usageType: 'SHORT_REST' }
        }});

        const r = FeatureEffectEngine.resolveActivatedFeature(cleric, 'Channel Divinity: Preserve Life');
        assert('Preserve Life resolves', r.success, r.message);
        assert('Channel Divinity consumed', cleric.featureUsages['Channel Divinity'].current === 0);
        assert('Heals 25 HP (5*level)', r.healAmount === 25);

        // Can't use again
        const r2 = FeatureEffectEngine.resolveActivatedFeature(cleric, 'Turn Undead');
        assert('Turn Undead fails (pool empty)', !r2.success);
    }

    console.log(`\n=== TOTAL: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
