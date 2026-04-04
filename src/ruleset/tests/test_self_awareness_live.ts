/**
 * Live Self-Awareness Test — Verifies companions reference their own equipment,
 * spells, class, and status in dialogue.
 *
 * Run: npx tsx src/ruleset/tests/test_self_awareness_live.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
try {
    const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    for (const line of envContent.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq > 0) process.env[t.substring(0, eq)] = t.substring(eq + 1);
    }
} catch { }

if (typeof localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (global as any).localStorage = {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
}
if (process.env.OPENROUTER_API_KEY) {
    localStorage.setItem('rpg_llm_api_keys', JSON.stringify({ openrouter: process.env.OPENROUTER_API_KEY }));
}

import { ConversationManager } from '../combat/managers/ConversationManager';
import { NPCFactory } from '../factories/NPCFactory';
import { CompanionManager } from '../combat/CompanionManager';
import { ContextManager } from '../agents/ContextManager';
import { GameState } from '../schemas/FullSaveStateSchema';

function createState(): GameState {
    return {
        character: {
            name: 'Aldric', level: 5, race: 'Human', class: 'Fighter',
            hp: { current: 40, max: 40, temp: 0 }, ac: 16,
            stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 11 },
            inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 200, pp: 0 }, items: [] },
            spellSlots: {}, conditions: [], skillProficiencies: [],
            equipmentSlots: {}, attunedItems: [],
            cantripsKnown: [], preparedSpells: [], knownSpells: [], spellbook: [],
        },
        mode: 'EXPLORATION',
        companions: [], worldNpcs: [],
        worldMap: { hexes: { '0,0': { npcs: [] as string[], interest_points: [], resourceNodes: [], biome: 'Forest', coordinates: [0, 0], name: 'Whispering Woods' } } },
        location: { hexId: '0,0', coordinates: [0, 0] },
        worldTime: { hour: 14, day: 5, month: 6, year: 1489, totalTurns: 20 },
        factions: [], activeQuests: [], conversationHistory: [],
        storySummary: '', lastNarrative: 'The forest is quiet, the battle with goblins still fresh in your mind.',
        activeDialogueNpcId: null, debugLog: [],
    } as any;
}

function addComp(state: GameState, name: string, role: string): string {
    const npc = NPCFactory.createNPC(name, false, undefined, role);
    npc.relationship.standing = 75;
    state.worldNpcs.push(npc);
    state.worldMap.hexes['0,0'].npcs.push(npc.id);
    CompanionManager.recruit(state, npc.id);
    return (state.companions[state.companions.length - 1] as any).meta.sourceNpcId;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runTest() {
    console.log('=== SELF-AWARENESS LIVE TEST ===\n');

    const state = createState();
    const guardId = addComp(state, 'Grimjaw Ironhelm', 'Guard');
    const scholarId = addComp(state, 'Lyra Moonwhisper', 'Scholar');

    const guard = state.companions[0];
    const scholar = state.companions[1];

    console.log(`Guard: ${guard.character.name} (${guard.character.class}, Lv${guard.character.level})`);
    console.log(`  Weapon: ${guard.character.equipmentSlots.mainHand ? 'equipped' : 'none'}`);
    console.log(`  Armor: ${guard.character.equipmentSlots.armor ? 'equipped' : 'none'}`);
    console.log(`  HP: ${guard.character.hp.current}/${guard.character.hp.max}, AC: ${guard.character.ac}`);
    console.log(`  Gold: ${guard.character.inventory.gold?.gp}gp`);

    console.log(`\nScholar: ${scholar.character.name} (${scholar.character.class}, Lv${scholar.character.level})`);
    console.log(`  Spells: ${scholar.character.preparedSpells.join(', ')}`);
    console.log(`  Cantrips: ${scholar.character.cantripsKnown.join(', ')}`);
    console.log(`  HP: ${scholar.character.hp.current}/${scholar.character.hp.max}, AC: ${scholar.character.ac}`);

    const cm = new ConversationManager(state, new ContextManager(), null as any, async () => {});

    // --- Scenario 1: Ask Guard about his equipment ---
    console.log('\n' + '='.repeat(60));
    console.log('SCENARIO 1: Ask Guard about his equipment');
    console.log('='.repeat(60));

    const g1 = await cm.startTalk(guardId, 'NORMAL');
    console.log(`>> ${g1}\n`);
    await delay(500);

    console.log('[Player]: "What weapons and armor do you have? Are you well-equipped?"');
    const g2 = await cm.processDialogueInput('What weapons and armor do you have? Are you well-equipped?');
    console.log(`>> ${g2}\n`);

    const mentionsWeapon = g2.toLowerCase().includes('sword') || g2.toLowerCase().includes('longsword') || g2.toLowerCase().includes('blade') || g2.toLowerCase().includes('weapon');
    const mentionsArmor = g2.toLowerCase().includes('mail') || g2.toLowerCase().includes('armor') || g2.toLowerCase().includes('chain');
    console.log(`[CHECK] Mentions weapon: ${mentionsWeapon ? 'YES ✅' : 'NO ❌'}`);
    console.log(`[CHECK] Mentions armor: ${mentionsArmor ? 'YES ✅' : 'NO ❌'}`);

    await cm.endTalk();
    await delay(500);

    // --- Scenario 2: Ask Scholar about her spells ---
    console.log('\n' + '='.repeat(60));
    console.log('SCENARIO 2: Ask Scholar about her spells');
    console.log('='.repeat(60));

    const s1 = await cm.startTalk(scholarId, 'NORMAL');
    console.log(`>> ${s1}\n`);
    await delay(500);

    console.log('[Player]: "What spells can you cast? Can you help us with magic?"');
    const s2 = await cm.processDialogueInput('What spells can you cast? Can you help us with magic?');
    console.log(`>> ${s2}\n`);

    const mentionsSpell = scholar.character.preparedSpells.some(
        (spell: string) => s2.toLowerCase().includes(spell.toLowerCase().split(' ')[0])
    );
    const mentionsMagic = s2.toLowerCase().includes('magic') || s2.toLowerCase().includes('spell') || s2.toLowerCase().includes('cast');
    console.log(`[CHECK] Mentions a specific spell: ${mentionsSpell ? 'YES ✅' : 'NO ❌'}`);
    console.log(`[CHECK] Mentions magic/spells: ${mentionsMagic ? 'YES ✅' : 'NO ❌'}`);

    await cm.endTalk();
    await delay(500);

    // --- Scenario 3: Ask Guard about location ---
    console.log('\n' + '='.repeat(60));
    console.log('SCENARIO 3: Ask Guard about the current location');
    console.log('='.repeat(60));

    const l1 = await cm.startTalk(guardId, 'NORMAL');
    console.log(`>> ${l1}\n`);
    await delay(500);

    console.log('[Player]: "What do you think of this place? Do you know where we are?"');
    const l2 = await cm.processDialogueInput('What do you think of this place? Do you know where we are?');
    console.log(`>> ${l2}\n`);

    const mentionsLocation = l2.toLowerCase().includes('forest') || l2.toLowerCase().includes('wood') || l2.toLowerCase().includes('whisper');
    console.log(`[CHECK] References location/environment: ${mentionsLocation ? 'YES ✅' : 'NO ❌'}`);

    await cm.endTalk();

    // --- Scenario 4: Ask wounded scholar about her condition ---
    console.log('\n' + '='.repeat(60));
    console.log('SCENARIO 4: Ask wounded Scholar about her condition');
    console.log('='.repeat(60));

    scholar.character.hp.current = 5; // Badly wounded

    const w1 = await cm.startTalk(scholarId, 'NORMAL');
    console.log(`>> ${w1}\n`);
    await delay(500);

    console.log('[Player]: "How are you feeling? You look hurt."');
    const w2 = await cm.processDialogueInput('How are you feeling? You look hurt.');
    console.log(`>> ${w2}\n`);

    const mentionsWound = w2.toLowerCase().includes('wound') || w2.toLowerCase().includes('hurt') || w2.toLowerCase().includes('pain') || w2.toLowerCase().includes('heal') || w2.toLowerCase().includes('blood');
    console.log(`[CHECK] References wounded state: ${mentionsWound ? 'YES ✅' : 'NO ❌'}`);

    await cm.endTalk();

    console.log('\n=== SELF-AWARENESS TEST COMPLETE ===');
}

runTest().catch(err => { console.error('Test failed:', err); process.exit(1); });
