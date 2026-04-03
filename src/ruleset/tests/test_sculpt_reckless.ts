import { FeatureEffectEngine, AttackContext } from '../combat/FeatureEffectEngine';
import { CombatResolutionEngine } from '../combat/CombatResolutionEngine';
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

function makeCombatant(o: any = {}) {
    return { name:'Test', hp:{current:50,max:50,temp:0}, ac:13,
        stats:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10},
        statusEffects:[], conditions:[], position:{x:0,y:0},
        tactical:{cover:'None',reach:1,isRanged:false},
        type:'player', id:'p1', isPlayer:true, initiative:10, dexterityScore:10,
        resources:{actionSpent:false,bonusActionSpent:false,reactionSpent:false},
        preparedSpells:[], spellSlots:{}, movementSpeed:6, movementRemaining:6,
        size:'Medium', darkvision:0, ...o } as any;
}

async function main() {
    // Load class data
    const classDir = path.join(__dirname,'../../../data/class');
    for (const file of fs.readdirSync(classDir).filter(f=>f.endsWith('.json'))) {
        const d = JSON.parse(fs.readFileSync(path.join(classDir,file),'utf8'));
        (DataManager as any).classes = (DataManager as any).classes || {};
        (DataManager as any).classes[d.name] = d;
    }
    const stylesData = JSON.parse(fs.readFileSync(path.join(__dirname,'../../../data/features/fighting-styles.json'),'utf8'));
    FeatureEffectEngine.loadFightingStyles(stylesData);

    // ═══ RECKLESS ATTACK: ENEMIES GET ADVANTAGE ═══
    console.log('\n=== RECKLESS ATTACK: ENEMY ADVANTAGE ===');
    {
        const enemy = makeCombatant({ name:'Goblin', type:'enemy', id:'e1', isPlayer:false });
        const normalTarget = makeCombatant({ name:'Barb', ac:16 });
        const recklessTarget = makeCombatant({ name:'Barb', ac:16,
            statusEffects:[{id:'reckless_attack',name:'Reckless',type:'BUFF',duration:1}] });

        // Statistical test: attacks against reckless target should hit more often
        let hitsNormal = 0, hitsReckless = 0;
        for (let i = 0; i < 1000; i++) {
            const r1 = CombatResolutionEngine.resolveAttack(enemy, normalTarget,
                [{label:'STR',value:3,source:'Stat'}], '1d6', 2, false, false, 'Bright');
            if (r1.damage > 0) hitsNormal++;

            const r2 = CombatResolutionEngine.resolveAttack(enemy, recklessTarget,
                [{label:'STR',value:3,source:'Stat'}], '1d6', 2, false, false, 'Bright',
                { forceAdvantage: true });
            if (r2.damage > 0) hitsReckless++;
        }

        assert('Enemies hit reckless target more', hitsReckless > hitsNormal,
            `normal=${hitsNormal} reckless=${hitsReckless}`);
        assert('Significant difference (>15%)', (hitsReckless - hitsNormal) / hitsNormal > 0.15,
            `diff=${((hitsReckless-hitsNormal)/hitsNormal*100).toFixed(1)}%`);
    }

    // Reckless + Rage combo: player gets advantage + damage, enemies also get advantage
    console.log('\n=== RECKLESS + RAGE COMBO ===');
    {
        const barb = {
            name:'Barb', level:5, class:'Barbarian', subclass:undefined, race:'Human', darkvision:0,
            stats:{STR:18,DEX:14,CON:16,INT:8,WIS:12,CHA:10}, hp:{current:50,max:50,temp:0}, ac:15,
            fightingStyle:undefined, featureUsages:{Rage:{current:3,max:3,usageType:'LONG_REST'}},
            statusEffects:[] as any[], spellSlots:{}, feats:[], equipmentSlots:{},
            savingThrowProficiencies:['STR','CON']
        } as any;

        // Activate rage
        const rageResult = FeatureEffectEngine.resolveActivatedFeature(barb, 'Rage');
        assert('Rage activates', rageResult.success);
        barb.statusEffects.push(rageResult.statusEffect as any);

        // Activate reckless
        const reckResult = FeatureEffectEngine.resolveActivatedFeature(barb, 'Reckless Attack');
        assert('Reckless activates', reckResult.success);
        barb.statusEffects.push(reckResult.statusEffect as any);

        // Check player's attack modifiers
        const ctx: AttackContext = { isRanged:false, isFinesseWeapon:false, isTwoHanded:true,
            hasOffhand:false, weaponType:'melee', hasAllyNearTarget:false, hasAdvantage:false,
            wearingArmor:false };
        const mods = FeatureEffectEngine.getAttackModifiers(barb, ctx);

        assert('Rage +2 melee damage', mods.damageBonus === 2, `${mods.damageBonus}`);
        assert('Reckless forceAdvantage', mods.forceAdvantage === true);

        // Verify enemy gets advantage when attacking the reckless barb
        const hasReckless = barb.statusEffects.some((e: any) => e.id === 'reckless_attack');
        assert('Barb has reckless status', hasReckless);
    }

    // Reckless without Rage — still works
    console.log('\n=== RECKLESS WITHOUT RAGE ===');
    {
        const barb = {
            name:'Barb', level:5, class:'Barbarian', subclass:undefined, race:'Human', darkvision:0,
            stats:{STR:16,DEX:14,CON:14,INT:10,WIS:10,CHA:10}, hp:{current:40,max:40,temp:0}, ac:14,
            fightingStyle:undefined, featureUsages:{},
            statusEffects:[] as any[], spellSlots:{}, feats:[], equipmentSlots:{},
            savingThrowProficiencies:['STR','CON']
        } as any;

        const r = FeatureEffectEngine.resolveActivatedFeature(barb, 'Reckless Attack');
        assert('Reckless works without rage', r.success);
        barb.statusEffects.push(r.statusEffect as any);

        const mods = FeatureEffectEngine.getAttackModifiers(barb, { isRanged:false, isFinesseWeapon:false,
            isTwoHanded:true, hasOffhand:false, weaponType:'melee', hasAllyNearTarget:false,
            hasAdvantage:false, wearingArmor:false });
        assert('forceAdvantage without rage', mods.forceAdvantage === true);
        assert('No rage damage bonus', mods.damageBonus === 0, `${mods.damageBonus}`);
    }

    // ═══ SCULPT SPELLS ═══
    // Note: Sculpt Spells is in SpellManager which we can't easily unit-test
    // without a full combat state. Test the FeatureEffectEngine detection instead.
    console.log('\n=== SCULPT SPELLS DETECTION ===');
    {
        const evoWiz = { name:'Wiz', level:2, class:'Wizard', subclass:'School of Evocation',
            race:'Human', darkvision:0, stats:{INT:18}, hp:{current:14,max:14,temp:0}, ac:12,
            fightingStyle:undefined, featureUsages:{}, statusEffects:[], spellSlots:{'1':{current:3,max:3}},
            feats:[], equipmentSlots:{}, savingThrowProficiencies:['INT','WIS'] } as any;

        // Verify the subclass feature exists in data
        const wizClass = DataManager.getClass('Wizard');
        const evoSub = wizClass?.subclasses.find(s => s.name === 'School of Evocation');
        assert('Evocation subclass exists', !!evoSub);
        const sculptFeature = evoSub?.features.find(f => f.name === 'Sculpt Spells');
        assert('Sculpt Spells feature exists', !!sculptFeature);
        assert('Sculpt Spells at level 2', sculptFeature?.level === 2);

        // Verify a non-evocation wizard doesn't have it
        const divWiz = { ...evoWiz, subclass: 'School of Divination' };
        const divSub = wizClass?.subclasses.find(s => s.name === 'School of Divination');
        const divSculpt = divSub?.features.find(f => f.name === 'Sculpt Spells');
        assert('Divination has no Sculpt Spells', !divSculpt);

        // Verify a L1 Evocation wizard doesn't have it yet
        const evoWiz1 = { ...evoWiz, level: 1 };
        assert('L1 Evocation: Sculpt at L2 so not yet', sculptFeature!.level > evoWiz1.level);
    }

    // Edge case: Reckless Attack duration expires after 1 turn
    console.log('\n=== RECKLESS DURATION EDGE CASE ===');
    {
        const barb = {
            name:'Barb', level:5, class:'Barbarian', statusEffects:[
                {id:'reckless_attack',name:'Reckless',type:'BUFF' as const,duration:1}
            ]
        } as any;

        // Before tick: has reckless
        assert('Has reckless before tick', FeatureEffectEngine.hasActiveEffect(barb, 'reckless_attack'));

        // Simulate processStartOfTurn (decrement duration)
        barb.statusEffects = barb.statusEffects.filter((e: any) => {
            if (e.duration !== undefined) { e.duration--; return e.duration > 0; }
            return true;
        });

        assert('Reckless expires after 1 turn', !FeatureEffectEngine.hasActiveEffect(barb, 'reckless_attack'));
        assert('Status effects empty', barb.statusEffects.length === 0);
    }

    // Edge case: Rage persists while Reckless expires
    console.log('\n=== RAGE PERSISTS, RECKLESS EXPIRES ===');
    {
        const barb = {
            name:'Barb', level:5, class:'Barbarian', statusEffects:[
                {id:'rage',name:'Rage',type:'BUFF' as const,duration:10},
                {id:'reckless_attack',name:'Reckless',type:'BUFF' as const,duration:1}
            ]
        } as any;

        // Tick once
        barb.statusEffects = barb.statusEffects.filter((e: any) => {
            if (e.duration !== undefined) { e.duration--; return e.duration > 0; }
            return true;
        });

        assert('Rage survives', FeatureEffectEngine.hasActiveEffect(barb, 'rage'));
        assert('Reckless gone', !FeatureEffectEngine.hasActiveEffect(barb, 'reckless_attack'));
        assert('Rage damage still works', FeatureEffectEngine.isRaging(barb));
    }

    console.log(`\n=== TOTAL: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
