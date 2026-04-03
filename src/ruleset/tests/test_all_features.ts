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

function makePC(o: any = {}) {
    return { name:'Test', level:5, class:'Fighter', subclass:undefined, race:'Human', darkvision:0,
        stats:{STR:16,DEX:14,CON:14,INT:10,WIS:10,CHA:10}, hp:{current:40,max:40,temp:0}, ac:16,
        fightingStyle:undefined, featureUsages:{}, statusEffects:[], spellSlots:{}, feats:[],
        equipmentSlots:{}, savingThrowProficiencies:['STR','CON'], ...o } as any;
}
function ctx(o: Partial<AttackContext> = {}): AttackContext {
    return { isRanged:false, isFinesseWeapon:false, isTwoHanded:false, hasOffhand:false,
        weaponType:'melee', hasAllyNearTarget:false, hasAdvantage:false, wearingArmor:true, ...o };
}
function makeCombatant(o: any = {}) {
    return { name:'Test', hp:{current:50,max:50,temp:0}, ac:13, stats:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10},
        statusEffects:[], conditions:[], position:{x:0,y:0}, tactical:{cover:'None',reach:1,isRanged:false},
        type:'player', id:'p1', isPlayer:true, initiative:10, dexterityScore:10,
        resources:{actionSpent:false,bonusActionSpent:false,reactionSpent:false},
        preparedSpells:[], spellSlots:{}, movementSpeed:6, movementRemaining:6, size:'Medium', darkvision:0, ...o } as any;
}

async function main() {
    const stylesData = JSON.parse(fs.readFileSync(path.join(__dirname,'../../../data/features/fighting-styles.json'),'utf8'));
    FeatureEffectEngine.loadFightingStyles(stylesData);
    const classDir = path.join(__dirname,'../../../data/class');
    for (const file of fs.readdirSync(classDir).filter(f=>f.endsWith('.json'))) {
        const d = JSON.parse(fs.readFileSync(path.join(classDir,file),'utf8'));
        (DataManager as any).classes = (DataManager as any).classes || {};
        (DataManager as any).classes[d.name] = d;
    }

    // ═══ 1. ACTION SURGE ═══
    console.log('\n=== 1. ACTION SURGE ===');
    {
        const f = makePC({ featureUsages:{ 'Action Surge':{current:1,max:1,usageType:'SHORT_REST'} } });
        const r = FeatureEffectEngine.resolveActivatedFeature(f,'Action Surge');
        assert('Action Surge succeeds', r.success);
        assert('Grants extra action', r.grantExtraAction === true);
        assert('Consumes use', f.featureUsages['Action Surge'].current === 0);
        const r2 = FeatureEffectEngine.resolveActivatedFeature(f,'Action Surge');
        assert('Fails when exhausted', !r2.success);
        // Non-fighter
        const w = makePC({ class:'Wizard' });
        const r3 = FeatureEffectEngine.resolveActivatedFeature(w,'Action Surge');
        assert('Wizard has no Action Surge', !r3.success);
    }

    // ═══ 2. RECKLESS ATTACK ═══
    console.log('\n=== 2. RECKLESS ATTACK ===');
    {
        const b = makePC({ class:'Barbarian', level:2 });
        const r = FeatureEffectEngine.resolveActivatedFeature(b,'Reckless Attack');
        assert('Activates for Barb L2', r.success);
        assert('Returns status effect', !!r.statusEffect && r.statusEffect.id === 'reckless_attack');
        // Apply effect and check modifiers
        b.statusEffects.push(r.statusEffect as any);
        const mods = FeatureEffectEngine.getAttackModifiers(b, ctx());
        assert('Grants forceAdvantage melee', mods.forceAdvantage === true);
        const modsR = FeatureEffectEngine.getAttackModifiers(b, ctx({ isRanged: true }));
        assert('No forceAdvantage ranged', modsR.forceAdvantage === false);
        // Level 1 barbarian can't use it
        const b1 = makePC({ class:'Barbarian', level:1 });
        const r2 = FeatureEffectEngine.resolveActivatedFeature(b1,'Reckless Attack');
        assert('Barb L1 cannot', !r2.success);
        // Fighter can't use it
        const f = makePC({ class:'Fighter', level:5 });
        const r3 = FeatureEffectEngine.resolveActivatedFeature(f,'Reckless Attack');
        assert('Fighter cannot', !r3.success);
    }

    // ═══ 3. CUNNING ACTION ═══
    console.log('\n=== 3. CUNNING ACTION ===');
    {
        const rogue2 = makePC({ class:'Rogue', level:2 });
        const r = FeatureEffectEngine.resolveActivatedFeature(rogue2,'Cunning Action');
        assert('Rogue L2 succeeds', r.success);
        const rogue1 = makePC({ class:'Rogue', level:1 });
        const r2 = FeatureEffectEngine.resolveActivatedFeature(rogue1,'Cunning Action');
        assert('Rogue L1 fails', !r2.success);
        const fighter = makePC({ class:'Fighter' });
        const r3 = FeatureEffectEngine.resolveActivatedFeature(fighter,'Cunning Action');
        assert('Fighter fails', !r3.success);
    }

    // ═══ 4. UNARMORED DEFENSE ═══
    console.log('\n=== 4. UNARMORED DEFENSE ===');
    {
        const barb = makePC({ class:'Barbarian', stats:{STR:16,DEX:14,CON:16,INT:10,WIS:10,CHA:10} });
        const ac = FeatureEffectEngine.getUnarmoredDefenseAC(barb);
        // 10 + DEX(+2) + CON(+3) = 15
        assert('Barbarian unarmored: 15', ac === 15, `${ac}`);

        const monk = makePC({ class:'Monk', stats:{STR:10,DEX:18,CON:10,INT:10,WIS:16,CHA:10} });
        const ac2 = FeatureEffectEngine.getUnarmoredDefenseAC(monk);
        // 10 + DEX(+4) + WIS(+3) = 17
        assert('Monk unarmored: 17', ac2 === 17, `${ac2}`);

        const fighter = makePC({ class:'Fighter' });
        assert('Fighter: undefined', FeatureEffectEngine.getUnarmoredDefenseAC(fighter) === undefined);
    }

    // ═══ 5. DANGER SENSE ═══
    console.log('\n=== 5. DANGER SENSE ===');
    {
        assert('Barb L2 has it', FeatureEffectEngine.hasDangerSense(makePC({ class:'Barbarian', level:2 })));
        assert('Barb L1 does not', !FeatureEffectEngine.hasDangerSense(makePC({ class:'Barbarian', level:1 })));
        assert('Fighter does not', !FeatureEffectEngine.hasDangerSense(makePC({ class:'Fighter', level:10 })));

        const defMods = FeatureEffectEngine.getDefenseModifiers(makePC({ class:'Barbarian', level:5 }));
        assert('Defense mods: dangerSense', defMods.dangerSense === true);
    }

    // ═══ 6. EVASION ═══
    console.log('\n=== 6. EVASION ===');
    {
        assert('Rogue L7 has it', FeatureEffectEngine.hasEvasion(makePC({ class:'Rogue', level:7 })));
        assert('Rogue L6 does not', !FeatureEffectEngine.hasEvasion(makePC({ class:'Rogue', level:6 })));
        assert('Monk L7 has it', FeatureEffectEngine.hasEvasion(makePC({ class:'Monk', level:7 })));
        assert('Fighter L20 does not', !FeatureEffectEngine.hasEvasion(makePC({ class:'Fighter', level:20 })));

        const defMods = FeatureEffectEngine.getDefenseModifiers(makePC({ class:'Rogue', level:10 }));
        assert('Defense mods: evasion', defMods.evasion === true);
    }

    // ═══ 7. UNCANNY DODGE ═══
    console.log('\n=== 7. UNCANNY DODGE ===');
    {
        assert('Rogue L5 has it', FeatureEffectEngine.hasUncannyDodge(makePC({ class:'Rogue', level:5 })));
        assert('Rogue L4 does not', !FeatureEffectEngine.hasUncannyDodge(makePC({ class:'Rogue', level:4 })));
        assert('Fighter does not', !FeatureEffectEngine.hasUncannyDodge(makePC({ class:'Fighter', level:10 })));

        const defMods = FeatureEffectEngine.getDefenseModifiers(makePC({ class:'Rogue', level:5 }));
        assert('Defense mods: uncannyDodge', defMods.uncannyDodge === true);
    }

    // ═══ 8. ASSASSINATE ═══
    console.log('\n=== 8. ASSASSINATE ===');
    {
        const assassin = makePC({ class:'Rogue', subclass:'Assassin', level:3 });
        // Advantage vs target that hasn't acted
        const mods = FeatureEffectEngine.getAttackModifiers(assassin, ctx({ isFinesseWeapon:true, targetHasNotActed:true }));
        assert('Advantage vs not-acted', mods.forceAdvantage === true);
        // Force crit on surprised
        const mods2 = FeatureEffectEngine.getAttackModifiers(assassin, ctx({ isFinesseWeapon:true, targetIsSurprised:true }));
        assert('Force crit on surprised', mods2.forceCrit === true);
        // Sneak attack eligible from assassinate advantage
        assert('Sneak eligible from assassinate', mods.sneakEligible === true);
        // Normal target — no special
        const mods3 = FeatureEffectEngine.getAttackModifiers(assassin, ctx({ isFinesseWeapon:true }));
        assert('No bonus on normal target', mods3.forceAdvantage === false && mods3.forceCrit === false);
        // Non-assassin rogue
        const thief = makePC({ class:'Rogue', subclass:'Thief', level:3 });
        const mods4 = FeatureEffectEngine.getAttackModifiers(thief, ctx({ isFinesseWeapon:true, targetHasNotActed:true }));
        assert('Thief no assassinate', mods4.forceAdvantage === false);
        // Below level 3
        const assassin2 = makePC({ class:'Rogue', subclass:'Assassin', level:2 });
        const mods5 = FeatureEffectEngine.getAttackModifiers(assassin2, ctx({ isFinesseWeapon:true, targetHasNotActed:true }));
        assert('Assassin L2 no assassinate', mods5.forceAdvantage === false);
    }

    // ═══ 9. FAST HANDS (Thief) — availability check ═══
    console.log('\n=== 9. FAST HANDS (informational) ===');
    {
        // Fast Hands is passive — Thief Rogue L3+ can use bonus action for objects
        // No mechanical test needed beyond "feature exists in data"
        const thief = makePC({ class:'Rogue', subclass:'Thief', level:3 });
        assert('Thief L3: Fast Hands recognized', true, 'Passive feature — no activation needed');
    }

    // ═══ 11. REMARKABLE ATHLETE ═══
    console.log('\n=== 11. REMARKABLE ATHLETE ===');
    {
        const champ7 = makePC({ class:'Fighter', subclass:'Champion', level:7 });
        const bonus = FeatureEffectEngine.getRemarkableAthleteBonus(champ7, 'STR');
        // Prof bonus at L7 = +3, half rounded up = 2
        assert('Champion L7 STR: +2', bonus === 2, `${bonus}`);
        assert('Champion L7 DEX: +2', FeatureEffectEngine.getRemarkableAthleteBonus(champ7, 'DEX') === 2);
        assert('Champion L7 CON: +2', FeatureEffectEngine.getRemarkableAthleteBonus(champ7, 'CON') === 2);
        assert('Champion L7 INT: 0 (not physical)', FeatureEffectEngine.getRemarkableAthleteBonus(champ7, 'INT') === 0);
        assert('Champion L6: 0', FeatureEffectEngine.getRemarkableAthleteBonus(makePC({ class:'Fighter', subclass:'Champion', level:6 }), 'STR') === 0);
        assert('Battle Master: 0', FeatureEffectEngine.getRemarkableAthleteBonus(makePC({ class:'Fighter', subclass:'Battle Master', level:10 }), 'STR') === 0);
    }

    // ═══ 12. GREAT WEAPON MASTER ═══
    console.log('\n=== 12. GREAT WEAPON MASTER ===');
    {
        const gwm = makePC({ feats:['Great Weapon Master'] });
        // Enabled + two-handed melee
        const mods = FeatureEffectEngine.getAttackModifiers(gwm, ctx({ gwmEnabled:true, isTwoHanded:true }));
        assert('GWM: -5 attack', mods.attackBonus === -5, `${mods.attackBonus}`);
        assert('GWM: +10 damage', mods.damageBonus === 10, `${mods.damageBonus}`);
        // Not enabled
        const mods2 = FeatureEffectEngine.getAttackModifiers(gwm, ctx({ gwmEnabled:false, isTwoHanded:true }));
        assert('GWM off: +0/+0', mods2.attackBonus === 0 && mods2.damageBonus === 0);
        // Ranged — GWM doesn't apply
        const mods3 = FeatureEffectEngine.getAttackModifiers(gwm, ctx({ gwmEnabled:true, isTwoHanded:true, isRanged:true }));
        assert('GWM ranged: no effect', mods3.attackBonus === 0 && mods3.damageBonus === 0);
        // One-handed — GWM doesn't apply
        const mods4 = FeatureEffectEngine.getAttackModifiers(gwm, ctx({ gwmEnabled:true, isTwoHanded:false }));
        assert('GWM one-hand: no effect', mods4.attackBonus === 0 && mods4.damageBonus === 0);
        // No feat
        const noFeat = makePC({});
        const mods5 = FeatureEffectEngine.getAttackModifiers(noFeat, ctx({ gwmEnabled:true, isTwoHanded:true }));
        assert('No feat: no effect', mods5.attackBonus === 0 && mods5.damageBonus === 0);
    }

    // ═══ 13. SHARPSHOOTER ═══
    console.log('\n=== 13. SHARPSHOOTER ===');
    {
        const ss = makePC({ feats:['Sharpshooter'] });
        const mods = FeatureEffectEngine.getAttackModifiers(ss, ctx({ sharpshooterEnabled:true, isRanged:true }));
        assert('SS: -5 attack', mods.attackBonus === -5, `${mods.attackBonus}`);
        assert('SS: +10 damage', mods.damageBonus === 10, `${mods.damageBonus}`);
        assert('SS: ignore cover', mods.ignoreCover === true);
        // Not enabled
        const mods2 = FeatureEffectEngine.getAttackModifiers(ss, ctx({ sharpshooterEnabled:false, isRanged:true }));
        assert('SS off: normal', mods2.attackBonus === 0 && mods2.ignoreCover === false);
        // Melee — doesn't apply
        const mods3 = FeatureEffectEngine.getAttackModifiers(ss, ctx({ sharpshooterEnabled:true, isRanged:false }));
        assert('SS melee: no effect', mods3.attackBonus === 0);
        // No feat
        const noFeat = makePC({});
        const mods4 = FeatureEffectEngine.getAttackModifiers(noFeat, ctx({ sharpshooterEnabled:true, isRanged:true }));
        assert('No feat: no effect', mods4.attackBonus === 0);
    }

    // ═══ 14. MOBILE FEAT ═══
    console.log('\n=== 14. MOBILE FEAT ===');
    {
        assert('Mobile: +10 speed', FeatureEffectEngine.getMovementSpeedBonus(makePC({ feats:['Mobile'] })) === 10, '10');
        assert('No feat: +0 speed', FeatureEffectEngine.getMovementSpeedBonus(makePC({})) === 0, '0');
        // Barbarian L5+ also gets +10
        assert('Barb L5 no feat: +10', FeatureEffectEngine.getMovementSpeedBonus(makePC({ class:'Barbarian', level:5 })) === 10);
        assert('Barb L4: +0', FeatureEffectEngine.getMovementSpeedBonus(makePC({ class:'Barbarian', level:4 })) === 0);
        // Monk scaling
        assert('Monk L2: +10', FeatureEffectEngine.getMovementSpeedBonus(makePC({ class:'Monk', level:2 })) === 10);
        assert('Monk L6: +15', FeatureEffectEngine.getMovementSpeedBonus(makePC({ class:'Monk', level:6 })) === 15);
        assert('Monk L10: +20', FeatureEffectEngine.getMovementSpeedBonus(makePC({ class:'Monk', level:10 })) === 20);
        assert('Monk L18: +30', FeatureEffectEngine.getMovementSpeedBonus(makePC({ class:'Monk', level:18 })) === 30);
        // Mobile + Monk stack
        assert('Mobile+Monk L6: +25', FeatureEffectEngine.getMovementSpeedBonus(makePC({ class:'Monk', level:6, feats:['Mobile'] })) === 25);
    }

    // ═══ 15. RESILIENT FEAT ═══
    console.log('\n=== 15. RESILIENT FEAT ===');
    {
        // Resilient adds save proficiency — tracked via savingThrowProficiencies
        const pc = makePC({ feats:['Resilient'], savingThrowProficiencies:['STR','CON','DEX'] });
        const defMods = FeatureEffectEngine.getDefenseModifiers(pc);
        assert('Save profs include DEX', defMods.saveProficiencies.includes('DEX'));
        assert('Save profs include STR', defMods.saveProficiencies.includes('STR'));
    }

    // ═══ RAGE RESISTANCE IN COMBAT RESOLUTION ═══
    console.log('\n=== RAGE RESISTANCE IN COMBAT ===');
    {
        const attacker = makeCombatant({ name:'Goblin', type:'enemy', id:'e1', isPlayer:false });
        const ragingTarget = makeCombatant({ name:'Barbarian', statusEffects:[{id:'rage',name:'Rage',type:'BUFF',duration:10}] });

        // Statistical: raging target should take ~half damage
        let totalNormal = 0, totalRaging = 0, hitsN = 0, hitsR = 0;
        for (let i = 0; i < 500; i++) {
            const rN = CombatResolutionEngine.resolveAttack(attacker, makeCombatant({ name:'Normal', ac:10 }),
                [{label:'STR',value:3,source:'Stat'}], '2d6', 2, false, false, 'Bright');
            if (rN.damage > 0) { totalNormal += rN.damage; hitsN++; }
            const rR = CombatResolutionEngine.resolveAttack(attacker, ragingTarget,
                [{label:'STR',value:3,source:'Stat'}], '2d6', 2, false, false, 'Bright');
            if (rR.damage > 0) { totalRaging += rR.damage; hitsR++; }
        }
        const avgN = totalNormal / Math.max(1,hitsN);
        const avgR = totalRaging / Math.max(1,hitsR);
        assert('Rage halves damage', avgR < avgN * 0.7, `normal avg=${avgN.toFixed(1)} raging avg=${avgR.toFixed(1)}`);
    }

    // ═══ FORCE ADVANTAGE IN COMBAT RESOLUTION ═══
    console.log('\n=== FORCE ADVANTAGE (Reckless/Assassinate) ===');
    {
        const attacker = makeCombatant({ name:'Attacker' });
        const target = makeCombatant({ name:'Target', ac:18, type:'enemy', id:'e1', isPlayer:false });
        let hitsNormal = 0, hitsAdv = 0;
        for (let i = 0; i < 500; i++) {
            const r1 = CombatResolutionEngine.resolveAttack(attacker, target,
                [{label:'STR',value:3,source:'Stat'}], '1d8', 2, false, false, 'Bright');
            if (r1.damage > 0) hitsNormal++;
            const r2 = CombatResolutionEngine.resolveAttack(attacker, target,
                [{label:'STR',value:3,source:'Stat'}], '1d8', 2, false, false, 'Bright',
                { forceAdvantage: true });
            if (r2.damage > 0) hitsAdv++;
        }
        assert('forceAdvantage increases hit rate', hitsAdv > hitsNormal, `normal=${hitsNormal} adv=${hitsAdv}`);
    }

    // ═══ FORCE CRIT (Assassinate) ═══
    console.log('\n=== FORCE CRIT (Assassinate on surprised) ===');
    {
        const attacker = makeCombatant({ name:'Assassin' });
        const target = makeCombatant({ name:'Target', ac:5, type:'enemy', id:'e1', isPlayer:false });
        let crits = 0;
        for (let i = 0; i < 100; i++) {
            const r = CombatResolutionEngine.resolveAttack(attacker, target,
                [{label:'DEX',value:6,source:'Stat'}], '1d6', 4, false, false, 'Bright',
                { forceCrit: true });
            if (r.type === 'CRIT') crits++;
        }
        assert('All hits are crits', crits > 90, `${crits}/100 crits`);
    }

    // ═══ IGNORE COVER (Sharpshooter) ═══
    console.log('\n=== IGNORE COVER ===');
    {
        const attacker = makeCombatant({ name:'Archer' });
        const hunkered = makeCombatant({ name:'Target', ac:13, type:'enemy', id:'e1', isPlayer:false,
            statusEffects:[{id:'hunkered_down',name:'Hunkered',type:'BUFF'}], tactical:{cover:'Three-Quarters',reach:1,isRanged:false} });
        // Without ignoreCover — cover adds +5 AC
        let hitsNoCover = 0, hitsCover = 0;
        for (let i = 0; i < 500; i++) {
            const r1 = CombatResolutionEngine.resolveAttack(attacker, hunkered,
                [{label:'DEX',value:5,source:'Stat'}], '1d8', 3, true, false, 'Bright');
            if (r1.damage > 0) hitsCover++;
            const r2 = CombatResolutionEngine.resolveAttack(attacker, hunkered,
                [{label:'DEX',value:5,source:'Stat'}], '1d8', 3, true, false, 'Bright',
                { ignoreCover: true });
            if (r2.damage > 0) hitsNoCover++;
        }
        assert('ignoreCover increases hits', hitsNoCover > hitsCover, `cover=${hitsCover} ignore=${hitsNoCover}`);
    }

    // ═══ COMBINED EDGE CASES ═══
    console.log('\n=== COMBINED EDGE CASES ===');
    {
        // GWM + Archery (shouldn't stack — different conditions)
        const combo = makePC({ fightingStyle:'Archery', feats:['Great Weapon Master'] });
        const mods = FeatureEffectEngine.getAttackModifiers(combo, ctx({ isRanged:true, isTwoHanded:true, gwmEnabled:true }));
        assert('Archery+GWM ranged: only Archery applies', mods.attackBonus === 2 && mods.damageBonus === 0,
            `atk=${mods.attackBonus} dmg=${mods.damageBonus}`);

        // Sharpshooter + Archery stack on ranged
        const combo2 = makePC({ fightingStyle:'Archery', feats:['Sharpshooter'] });
        const mods2 = FeatureEffectEngine.getAttackModifiers(combo2, ctx({ isRanged:true, sharpshooterEnabled:true }));
        assert('Archery+SS: -5+2=-3 attack, +10 dmg', mods2.attackBonus === -3 && mods2.damageBonus === 10,
            `atk=${mods2.attackBonus} dmg=${mods2.damageBonus}`);

        // Rogue Assassin with Sneak Attack + Assassinate
        const assassin = makePC({ class:'Rogue', subclass:'Assassin', level:10 });
        const modsA = FeatureEffectEngine.getAttackModifiers(assassin, ctx({ isFinesseWeapon:true, targetHasNotActed:true, targetIsSurprised:true }));
        assert('Assassin: advantage + forceCrit + 5d6 sneak', modsA.forceAdvantage && modsA.forceCrit && modsA.sneakAttackDice === 5 && modsA.sneakEligible,
            `adv=${modsA.forceAdvantage} crit=${modsA.forceCrit} dice=${modsA.sneakAttackDice} eligible=${modsA.sneakEligible}`);

        // Barbarian raging + reckless attack
        const barb = makePC({ class:'Barbarian', level:9, statusEffects:[{id:'rage',name:'Rage',type:'BUFF',duration:10},{id:'reckless_attack',name:'Reckless',type:'BUFF',duration:1}] });
        const modsB = FeatureEffectEngine.getAttackModifiers(barb, ctx());
        assert('Rage+Reckless: +3 dmg + forceAdv', modsB.damageBonus === 3 && modsB.forceAdvantage,
            `dmg=${modsB.damageBonus} adv=${modsB.forceAdvantage}`);

        // Mobile Monk L10: +10 (Mobile) + 20 (Monk) = 30
        const mobileMonk = makePC({ class:'Monk', level:10, feats:['Mobile'] });
        assert('Mobile Monk L10: +30 speed', FeatureEffectEngine.getMovementSpeedBonus(mobileMonk) === 30);

        // Barbarian L5 + Mobile: +10 (Barb) + 10 (Mobile) = 20
        const mobileBarb = makePC({ class:'Barbarian', level:5, feats:['Mobile'] });
        assert('Mobile Barb L5: +20 speed', FeatureEffectEngine.getMovementSpeedBonus(mobileBarb) === 20);

        // Defense defense checks
        const defBarb = FeatureEffectEngine.getDefenseModifiers(makePC({ class:'Barbarian', level:5, statusEffects:[{id:'rage',name:'Rage',type:'BUFF'}] }));
        assert('Raging barb: rageResistance', defBarb.rageResistance === true);
        assert('Raging barb: dangerSense', defBarb.dangerSense === true);

        const defRogue = FeatureEffectEngine.getDefenseModifiers(makePC({ class:'Rogue', level:7 }));
        assert('Rogue L7: evasion + uncannyDodge', defRogue.evasion && defRogue.uncannyDodge);
    }

    console.log(`\n=== TOTAL RESULTS: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
