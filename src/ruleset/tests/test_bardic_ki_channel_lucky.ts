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

function makePC(o: any = {}) {
    return { name:'Test', level:5, class:'Fighter', subclass:undefined, race:'Human', darkvision:0,
        stats:{STR:16,DEX:14,CON:14,INT:10,WIS:16,CHA:14}, hp:{current:40,max:40,temp:0}, ac:16,
        fightingStyle:undefined, featureUsages:{}, statusEffects:[], spellSlots:{}, feats:[],
        equipmentSlots:{}, savingThrowProficiencies:['STR','CON'], ...o } as any;
}

async function main() {
    const classDir = path.join(__dirname,'../../../data/class');
    for (const file of fs.readdirSync(classDir).filter(f=>f.endsWith('.json'))) {
        const d = JSON.parse(fs.readFileSync(path.join(classDir,file),'utf8'));
        (DataManager as any).classes = (DataManager as any).classes || {};
        (DataManager as any).classes[d.name] = d;
    }
    const stylesData = JSON.parse(fs.readFileSync(path.join(__dirname,'../../../data/features/fighting-styles.json'),'utf8'));
    FeatureEffectEngine.loadFightingStyles(stylesData);

    // ═══ BARDIC INSPIRATION ═══
    console.log('\n=== BARDIC INSPIRATION ===');
    {
        const bard5 = makePC({ class:'Bard', level:5, featureUsages:{ 'Bardic Inspiration':{current:3,max:3,usageType:'LONG_REST'} } });

        // Activates and returns die
        const r = FeatureEffectEngine.resolveActivatedFeature(bard5, 'Bardic Inspiration', { targetName: 'Companion' });
        assert('Bard L5 activates', r.success);
        assert('Returns d8 at L5', r.message.includes('d8'), r.message);
        assert('Returns status effect', !!r.statusEffect);
        assert('Status is inspiration', r.statusEffect?.id === 'bardic_inspiration');
        assert('Consumes use', bard5.featureUsages['Bardic Inspiration'].current === 2);

        // Die scaling
        const bard1 = makePC({ class:'Bard', level:1, featureUsages:{ 'Bardic Inspiration':{current:3,max:3,usageType:'LONG_REST'} } });
        const r1 = FeatureEffectEngine.resolveActivatedFeature(bard1, 'Bardic Inspiration');
        assert('Bard L1: d6', r1.message.includes('d6'));

        const bard10 = makePC({ class:'Bard', level:10, featureUsages:{ 'Bardic Inspiration':{current:3,max:3,usageType:'LONG_REST'} } });
        const r10 = FeatureEffectEngine.resolveActivatedFeature(bard10, 'Bardic Inspiration');
        assert('Bard L10: d10', r10.message.includes('d10'));

        const bard15 = makePC({ class:'Bard', level:15, featureUsages:{ 'Bardic Inspiration':{current:3,max:3,usageType:'LONG_REST'} } });
        const r15 = FeatureEffectEngine.resolveActivatedFeature(bard15, 'Bardic Inspiration');
        assert('Bard L15: d12', r15.message.includes('d12'));

        // Exhaust uses
        FeatureEffectEngine.resolveActivatedFeature(bard5, 'Bardic Inspiration');
        const rEnd = FeatureEffectEngine.resolveActivatedFeature(bard5, 'Bardic Inspiration');
        assert('3rd use succeeds', rEnd.success);
        const rFail = FeatureEffectEngine.resolveActivatedFeature(bard5, 'Bardic Inspiration');
        assert('4th use fails', !rFail.success);

        // Non-bard
        const fighter = makePC({ class:'Fighter' });
        assert('Fighter cannot inspire', !FeatureEffectEngine.resolveActivatedFeature(fighter, 'Bardic Inspiration').success);

        // Target name in message
        assert('Target name in message', r.message.includes('Companion'));

        // Utility
        assert('Die size helper L1=d6', FeatureEffectEngine.getBardicInspirationDie(1) === 'd6');
        assert('Die size helper L5=d8', FeatureEffectEngine.getBardicInspirationDie(5) === 'd8');
        assert('Die size helper L10=d10', FeatureEffectEngine.getBardicInspirationDie(10) === 'd10');
        assert('Die size helper L15=d12', FeatureEffectEngine.getBardicInspirationDie(15) === 'd12');
    }

    // ═══ KI: FLURRY OF BLOWS ═══
    console.log('\n=== KI: FLURRY OF BLOWS ===');
    {
        const monk = makePC({ class:'Monk', level:5, featureUsages:{ Ki:{current:5,max:5,usageType:'SHORT_REST'} } });
        const r = FeatureEffectEngine.resolveActivatedFeature(monk, 'Ki: Flurry of Blows');
        assert('Flurry succeeds', r.success);
        assert('Returns flurry effect', r.statusEffect?.id === 'flurry_of_blows');
        assert('Consumes 1 Ki', monk.featureUsages.Ki.current === 4);
        assert('Message mentions strikes', r.message.includes('unarmed strikes'));
    }

    // ═══ KI: PATIENT DEFENSE ═══
    console.log('\n=== KI: PATIENT DEFENSE ===');
    {
        const monk = makePC({ class:'Monk', level:5, featureUsages:{ Ki:{current:5,max:5,usageType:'SHORT_REST'} } });
        const r = FeatureEffectEngine.resolveActivatedFeature(monk, 'Ki: Patient Defense');
        assert('Patient Defense succeeds', r.success);
        assert('Returns dodge effect', r.statusEffect?.id === 'dodge');
        assert('Consumes 1 Ki', monk.featureUsages.Ki.current === 4);
    }

    // ═══ KI: STEP OF THE WIND ═══
    console.log('\n=== KI: STEP OF THE WIND ===');
    {
        const monk = makePC({ class:'Monk', level:5, featureUsages:{ Ki:{current:5,max:5,usageType:'SHORT_REST'} } });
        const r = FeatureEffectEngine.resolveActivatedFeature(monk, 'Ki: Step of the Wind');
        assert('Step succeeds', r.success);
        assert('Returns step effect', r.statusEffect?.id === 'step_of_the_wind');
        assert('Consumes 1 Ki', monk.featureUsages.Ki.current === 4);
    }

    // ═══ KI: EDGE CASES ═══
    console.log('\n=== KI: EDGE CASES ===');
    {
        // Level 1 monk (no Ki yet)
        const monk1 = makePC({ class:'Monk', level:1 });
        assert('Monk L1 no Ki', !FeatureEffectEngine.resolveActivatedFeature(monk1, 'Ki: Flurry of Blows').success);

        // Non-monk
        const fighter = makePC({ class:'Fighter' });
        assert('Fighter no Ki', !FeatureEffectEngine.resolveActivatedFeature(fighter, 'Ki: Flurry of Blows').success);

        // Exhaust Ki pool
        const monk = makePC({ class:'Monk', level:2, featureUsages:{ Ki:{current:1,max:2,usageType:'SHORT_REST'} } });
        assert('Last Ki point works', FeatureEffectEngine.resolveActivatedFeature(monk, 'Ki: Flurry of Blows').success);
        assert('Ki exhausted', !FeatureEffectEngine.resolveActivatedFeature(monk, 'Ki: Patient Defense').success);

        // Ki pool utility
        assert('Ki pool = level', FeatureEffectEngine.getKiPool(makePC({ class:'Monk', level:8 })) === 8);
        assert('Ki pool L1 = 0', FeatureEffectEngine.getKiPool(makePC({ class:'Monk', level:1 })) === 0);
        assert('Ki pool Fighter = 0', FeatureEffectEngine.getKiPool(makePC({ class:'Fighter' })) === 0);
    }

    // ═══ CHANNEL DIVINITY: TURN UNDEAD ═══
    console.log('\n=== CHANNEL DIVINITY: TURN UNDEAD ===');
    {
        const cleric = makePC({ class:'Cleric', level:5, subclass:'Life Domain', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        const r = FeatureEffectEngine.resolveActivatedFeature(cleric, 'Turn Undead');
        assert('Turn Undead succeeds', r.success);
        assert('Mentions WIS save DC', r.message.includes('DC'));
        assert('Mentions destroy at L5', r.message.includes('CR'));
        assert('Consumes Channel Divinity', cleric.featureUsages['Channel Divinity'].current === 0);

        // Can't use again
        assert('No uses left', !FeatureEffectEngine.resolveActivatedFeature(cleric, 'Turn Undead').success);

        // Non-cleric
        assert('Fighter cannot', !FeatureEffectEngine.resolveActivatedFeature(makePC({ class:'Fighter' }), 'Turn Undead').success);

        // Level 1 cleric (no channel divinity yet)
        assert('Cleric L1 cannot', !FeatureEffectEngine.resolveActivatedFeature(makePC({ class:'Cleric', level:1 }), 'Turn Undead').success);
    }

    // ═══ CHANNEL DIVINITY: DOMAIN-SPECIFIC ═══
    console.log('\n=== CHANNEL DIVINITY: DOMAIN-SPECIFIC ===');
    {
        // Life Domain: Preserve Life
        const life = makePC({ class:'Cleric', level:5, subclass:'Life Domain', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        const rLife = FeatureEffectEngine.resolveActivatedFeature(life, 'Channel Divinity: Preserve Life');
        assert('Preserve Life succeeds', rLife.success);
        assert('Heals 5*level=25', rLife.healAmount === 25, `${rLife.healAmount}`);

        // Light Domain: Radiance of the Dawn
        const light = makePC({ class:'Cleric', level:5, subclass:'Light Domain', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        const rLight = FeatureEffectEngine.resolveActivatedFeature(light, 'Channel Divinity: Radiance of the Dawn');
        assert('Radiance succeeds', rLight.success);
        assert('Deals damage (negative heal)', (rLight.healAmount ?? 0) < 0, `${rLight.healAmount}`);

        // War Domain: Guided Strike
        const war = makePC({ class:'Cleric', level:5, subclass:'War Domain', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        const rWar = FeatureEffectEngine.resolveActivatedFeature(war, 'Channel Divinity: Guided Strike');
        assert('Guided Strike succeeds', rWar.success);
        assert('Returns +10 attack effect', rWar.statusEffect?.modifier === 10);

        // Wrong domain can't use other domain's power
        const warTryLife = makePC({ class:'Cleric', level:5, subclass:'War Domain', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        assert('War cannot Preserve Life', !FeatureEffectEngine.resolveActivatedFeature(warTryLife, 'Channel Divinity: Preserve Life').success);
    }

    // ═══ CHANNEL DIVINITY: PALADIN OATHS ═══
    console.log('\n=== CHANNEL DIVINITY: PALADIN OATHS ===');
    {
        // Devotion: Sacred Weapon
        const devotion = makePC({ class:'Paladin', level:3, subclass:'Oath of Devotion', stats:{STR:16,DEX:10,CON:14,INT:10,WIS:10,CHA:16}, featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        const rSacred = FeatureEffectEngine.resolveActivatedFeature(devotion, 'Channel Divinity: Sacred Weapon');
        assert('Sacred Weapon succeeds', rSacred.success);
        assert('CHA bonus (+3) to attack', rSacred.statusEffect?.modifier === 3, `${rSacred.statusEffect?.modifier}`);

        // Vengeance: Vow of Enmity
        const vengeance = makePC({ class:'Paladin', level:3, subclass:'Oath of Vengeance', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        const rVow = FeatureEffectEngine.resolveActivatedFeature(vengeance, 'Channel Divinity: Vow of Enmity', { targetName: 'Dragon' });
        assert('Vow of Enmity succeeds', rVow.success);
        assert('Mentions target name', rVow.message.includes('Dragon'));

        // Vengeance: Abjure Enemy
        const vengeance2 = makePC({ class:'Paladin', level:3, subclass:'Oath of Vengeance', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        const rAbjure = FeatureEffectEngine.resolveActivatedFeature(vengeance2, 'Channel Divinity: Abjure Enemy');
        assert('Abjure Enemy succeeds', rAbjure.success);
        assert('Returns debuff effect', rAbjure.statusEffect?.type === 'DEBUFF');

        // Ancients: Nature's Wrath
        const ancients = makePC({ class:'Paladin', level:3, subclass:'Oath of the Ancients', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        const rNature = FeatureEffectEngine.resolveActivatedFeature(ancients, "Channel Divinity: Nature's Wrath");
        assert("Nature's Wrath succeeds", rNature.success);

        // Ancients: Turn the Faithless
        const ancients2 = makePC({ class:'Paladin', level:3, subclass:'Oath of the Ancients', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        const rFaithless = FeatureEffectEngine.resolveActivatedFeature(ancients2, 'Channel Divinity: Turn the Faithless');
        assert('Turn the Faithless succeeds', rFaithless.success);

        // Wrong oath
        assert('Devotion cannot Vow', !FeatureEffectEngine.resolveActivatedFeature(
            makePC({ class:'Paladin', subclass:'Oath of Devotion', featureUsages:{'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'}} }),
            'Channel Divinity: Vow of Enmity').success);
    }

    // ═══ LUCKY FEAT ═══
    console.log('\n=== LUCKY FEAT ===');
    {
        const lucky = makePC({ feats:['Lucky'] });

        // First use
        const r = FeatureEffectEngine.resolveActivatedFeature(lucky, 'Lucky');
        assert('Lucky succeeds', r.success);
        assert('Returns reroll value', !!r.statusEffect);
        assert('Reroll is 1-20', (r.statusEffect?.modifier as number) >= 1 && (r.statusEffect?.modifier as number) <= 20, `${r.statusEffect?.modifier}`);
        assert('2 points remaining', lucky.featureUsages['Lucky'].current === 2);

        // Use all 3
        FeatureEffectEngine.resolveActivatedFeature(lucky, 'Lucky');
        FeatureEffectEngine.resolveActivatedFeature(lucky, 'Lucky');
        assert('0 remaining after 3 uses', lucky.featureUsages['Lucky'].current === 0);

        const rFail = FeatureEffectEngine.resolveActivatedFeature(lucky, 'Lucky');
        assert('4th use fails', !rFail.success);

        // No feat
        assert('No feat cannot', !FeatureEffectEngine.resolveActivatedFeature(makePC({}), 'Lucky').success);

        // Utility
        assert('Points remaining: 3 at start', FeatureEffectEngine.getLuckyPointsRemaining(makePC({ feats:['Lucky'] })) === 3);
        assert('Points remaining: 0 no feat', FeatureEffectEngine.getLuckyPointsRemaining(makePC({})) === 0);
    }

    // ═══ CHANNEL DIVINITY SHARED POOL ═══
    console.log('\n=== CHANNEL DIVINITY: SHARED POOL ===');
    {
        // Using Turn Undead should deplete the same pool as domain-specific
        const cleric = makePC({ class:'Cleric', level:5, subclass:'Life Domain', featureUsages:{ 'Channel Divinity':{current:1,max:1,usageType:'SHORT_REST'} } });
        FeatureEffectEngine.resolveActivatedFeature(cleric, 'Turn Undead');
        assert('Turn Undead depletes pool', cleric.featureUsages['Channel Divinity'].current === 0);
        assert('Preserve Life fails after Turn Undead', !FeatureEffectEngine.resolveActivatedFeature(cleric, 'Channel Divinity: Preserve Life').success);
    }

    // ═══ CROSS-CLASS VALIDATION ═══
    console.log('\n=== CROSS-CLASS VALIDATION ===');
    {
        // Ensure no cross-class leakage
        const rogue = makePC({ class:'Rogue', level:5 });
        assert('Rogue cannot Rage', !FeatureEffectEngine.resolveActivatedFeature(rogue, 'Rage').success);
        assert('Rogue cannot Inspire', !FeatureEffectEngine.resolveActivatedFeature(rogue, 'Bardic Inspiration').success);
        assert('Rogue cannot Turn Undead', !FeatureEffectEngine.resolveActivatedFeature(rogue, 'Turn Undead').success);
        assert('Rogue cannot Ki', !FeatureEffectEngine.resolveActivatedFeature(rogue, 'Ki: Flurry of Blows').success);
        assert('Rogue cannot Lucky (no feat)', !FeatureEffectEngine.resolveActivatedFeature(rogue, 'Lucky').success);
    }

    console.log(`\n=== TOTAL: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
