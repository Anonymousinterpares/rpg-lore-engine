/**
 * Multi-Turn NPC Dialogue Integration Test
 *
 * Creates 5 NPCs with deliberately contrasting trait profiles,
 * sends each the SAME prompts across 3 turns, and compares
 * LLM responses to verify behavioral differentiation.
 *
 * Requires: OPENROUTER_API_KEY in .env
 * Run: npx tsx src/ruleset/tests/test_npc_dialogue_integration.ts
 */

// Load .env manually (no dotenv dependency)
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
    const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            process.env[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
        }
    }
} catch { /* no .env file */ }

// Node.js localStorage shim (stores API keys in memory for this session)
if (typeof localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (global as any).localStorage = {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, val: string) => { store[key] = val; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
}

// Inject the API key into localStorage so LLMClient can find it
const apiKey = process.env.OPENROUTER_API_KEY;
if (apiKey) {
    localStorage.setItem('rpg_llm_api_keys', JSON.stringify({ openrouter: apiKey }));
    console.log('[Setup] API key loaded from .env');
} else {
    console.error('[Setup] ERROR: OPENROUTER_API_KEY not found in .env. Aborting.');
    process.exit(1);
}

import { NPCFactory } from '../factories/NPCFactory';
import { NPCService } from '../agents/NPCService';
import { GameState } from '../schemas/FullSaveStateSchema';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { toStructuredTraits, formatTraitsForPrompt } from '../data/TraitRegistry';

// Minimal GameState stub for NPCService
const mockState: GameState = {
    character: {
        name: 'Aldric',
        level: 5,
        race: 'Human',
        class: 'Fighter',
        hp: { current: 40, max: 40, temp: 0 },
        stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 11 },
    },
    mode: 'EXPLORATION',
    worldNpcs: [],
    conversationHistory: [],
    worldTime: { hour: 14, day: 5, month: 6, year: 1489, totalTurns: 20 },
} as any;

// ---------------------------------------------------------------
// Create 5 NPCs with deliberately contrasting personalities
// ---------------------------------------------------------------
function createTestNPCs(): WorldNPC[] {
    return [
        NPCFactory.createNPC('Grimjaw Ironhelm', false, undefined, 'Guard'),
        NPCFactory.createNPC('Lyra Moonwhisper', false, undefined, 'Scholar'),
        NPCFactory.createNPC('Rotgut the Vile', false, undefined, 'Bandit'),
        NPCFactory.createNPC('Petra Fairwind', true, 'lords_alliance', 'Merchant'),
        NPCFactory.createNPC('Old Mossbeard', false, 'emerald_enclave', 'Hermit'),
    ];
}

// ---------------------------------------------------------------
// Dialogue prompts — same 3 prompts sent to all 5 NPCs
// ---------------------------------------------------------------
const DIALOGUE_PROMPTS = [
    "Hello there, stranger. What brings you to these parts?",
    "I'm looking for information about a nearby dungeon. Do you know anything?",
    "I could use some help. Would you be willing to join me on a dangerous quest?"
];

async function runDialogueTest() {
    console.log('=== MULTI-TURN NPC DIALOGUE INTEGRATION TEST ===\n');
    console.log('This test sends the same 3 prompts to 5 different NPCs');
    console.log('and verifies that trait-driven LLM responses are differentiated.\n');

    const npcs = createTestNPCs();

    // Print NPC profiles
    console.log('--- NPC Profiles ---\n');
    for (const npc of npcs) {
        const structured = toStructuredTraits(npc.traits);
        console.log(`${npc.name} (${npc.role}${npc.factionId ? `, ${npc.factionId}` : ''})`);
        console.log(`  Traits: ${formatTraitsForPrompt(structured).split('\n').join(' | ')}`);
        console.log(`  Standing: ${npc.relationship.standing} | Merchant: ${npc.isMerchant}`);
        console.log(`  Stats: STR=${npc.stats.STR} DEX=${npc.stats.DEX} CON=${npc.stats.CON} INT=${npc.stats.INT} WIS=${npc.stats.WIS} CHA=${npc.stats.CHA}`);
        console.log('');
    }

    // Run dialogues
    const allResponses: Record<string, string[]> = {};

    for (let turn = 0; turn < DIALOGUE_PROMPTS.length; turn++) {
        const prompt = DIALOGUE_PROMPTS[turn];
        console.log(`\n${'='.repeat(70)}`);
        console.log(`TURN ${turn + 1}: Player says: "${prompt}"`);
        console.log('='.repeat(70));

        for (const npc of npcs) {
            console.log(`\n  [${npc.name}] (${npc.role}) responding...`);

            try {
                const response = await NPCService.generateDialogue(mockState, npc, prompt);

                if (!allResponses[npc.name]) allResponses[npc.name] = [];
                allResponses[npc.name].push(response || '(no response)');

                console.log(`  >> ${response || '(no response)'}`);

                // Show relationship delta evaluation
                if (response) {
                    const delta = await NPCService.evaluateRelationshipDelta(npc, prompt, response);
                    if (delta && delta.delta !== 0) {
                        // Apply the delta to the NPC (mirrors what GameLoop does)
                        npc.relationship.standing = Math.max(-100, Math.min(100, npc.relationship.standing + delta.delta));
                        npc.relationship.interactionLog = npc.relationship.interactionLog || [];
                        npc.relationship.interactionLog.push({
                            event: delta.reason,
                            delta: delta.delta,
                            timestamp: new Date().toISOString()
                        });
                        console.log(`  [Relationship: ${delta.delta > 0 ? '+' : ''}${delta.delta} — ${delta.reason}]`);
                        console.log(`  [Standing now: ${npc.relationship.standing}]`);
                    } else {
                        console.log(`  [Relationship: no change]`);
                    }
                }
            } catch (err: any) {
                console.error(`  ERROR: ${err.message}`);
                if (!allResponses[npc.name]) allResponses[npc.name] = [];
                allResponses[npc.name].push(`ERROR: ${err.message}`);
            }

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // ---------------------------------------------------------------
    // Analysis: Check differentiation
    // ---------------------------------------------------------------
    console.log(`\n${'='.repeat(70)}`);
    console.log('DIFFERENTIATION ANALYSIS');
    console.log('='.repeat(70));

    console.log('\n--- Conversation Memory Check ---');
    for (const npc of npcs) {
        console.log(`  ${npc.name}: ${npc.conversationHistory.length} entries in conversation history`);
    }

    console.log('\n--- Relationship Standing After Dialogue ---');
    for (const npc of npcs) {
        const log = npc.relationship.interactionLog || [];
        console.log(`  ${npc.name}: standing=${npc.relationship.standing} (${log.length} logged interactions)`);
        for (const entry of log) {
            console.log(`    ${entry.delta > 0 ? '+' : ''}${entry.delta}: ${entry.event}`);
        }
    }

    console.log('\n--- Response Length Comparison ---');
    for (const npc of npcs) {
        const responses = allResponses[npc.name] || [];
        const avgLen = responses.reduce((sum, r) => sum + r.length, 0) / responses.length;
        console.log(`  ${npc.name}: avg ${Math.round(avgLen)} chars across ${responses.length} turns`);
    }

    console.log('\n--- Tone/Style Fingerprint (first response excerpt) ---');
    for (const npc of npcs) {
        const first = (allResponses[npc.name] || ['(none)'])[0];
        console.log(`  ${npc.name}: "${first.substring(0, 120)}${first.length > 120 ? '...' : ''}"`);
    }

    console.log('\n=== TEST COMPLETE ===');
    console.log('Review the responses above to confirm each NPC has a distinct voice');
    console.log('driven by their unique trait combination.\n');
}

runDialogueTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
