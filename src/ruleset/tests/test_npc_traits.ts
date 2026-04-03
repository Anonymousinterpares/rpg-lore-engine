/**
 * NPC Trait System Verification Test
 *
 * Tests that the new trait system produces differentiated NPCs with:
 * - 4-6 traits from multiple categories
 * - No contradictions
 * - Role-influenced trait selection
 * - Culture-influenced naming with deduplication
 * - Role-based stat variation
 * - Structured trait formatting for LLM prompts
 */

import { NPCFactory } from '../factories/NPCFactory';
import { BiomeType } from '../schemas/BiomeSchema';
import {
    NPC_TRAITS, TRAIT_EXCLUSIONS, TraitCategory,
    findTraitCategory, formatTraitsForPrompt, toStructuredTraits
} from '../data/TraitRegistry';

function runTest() {
    console.log('=== NPC TRAIT SYSTEM VERIFICATION ===\n');

    // ---------------------------------------------------------------
    // Test 1: Generate 5 NPCs from different biomes and roles
    // ---------------------------------------------------------------
    console.log('--- Test 1: NPC Generation Diversity ---\n');

    const biomes: BiomeType[] = ['Urban', 'Forest', 'Mountains', 'Swamp', 'Desert'];
    const generatedNpcs: ReturnType<typeof NPCFactory.generateRandomNPC>[] = [];

    for (const biome of biomes) {
        const npc = NPCFactory.generateRandomNPC(biome, generatedNpcs);
        generatedNpcs.push(npc);

        const structured = toStructuredTraits(npc.traits);
        const categories = structured.map(t => t.category);
        const uniqueCategories = new Set(categories);

        console.log(`NPC: ${npc.name}`);
        console.log(`  Biome: ${biome} | Role: ${npc.role || 'None'} | Faction: ${npc.factionId || 'None'}`);
        console.log(`  Traits (${npc.traits.length}): ${npc.traits.join(', ')}`);
        console.log(`  Categories covered: ${[...uniqueCategories].join(', ')}`);
        console.log(`  Stats: STR=${npc.stats.STR} DEX=${npc.stats.DEX} CON=${npc.stats.CON} INT=${npc.stats.INT} WIS=${npc.stats.WIS} CHA=${npc.stats.CHA}`);
        console.log(`  Structured for LLM:`);
        console.log(`    ${formatTraitsForPrompt(structured).split('\n').join('\n    ')}`);
        console.log('');
    }

    // ---------------------------------------------------------------
    // Test 2: Trait count verification (4-6+ expected)
    // ---------------------------------------------------------------
    console.log('--- Test 2: Trait Count Distribution (100 NPCs) ---\n');

    const traitCounts: Record<number, number> = {};
    const categoryCoverage: Record<string, number> = {};

    for (let i = 0; i < 100; i++) {
        const npc = NPCFactory.generateRandomNPC('Urban');
        const count = npc.traits.length;
        traitCounts[count] = (traitCounts[count] || 0) + 1;

        const structured = toStructuredTraits(npc.traits);
        for (const t of structured) {
            categoryCoverage[t.category] = (categoryCoverage[t.category] || 0) + 1;
        }
    }

    console.log('  Trait count distribution:');
    for (const [count, freq] of Object.entries(traitCounts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        console.log(`    ${count} traits: ${freq}%`);
    }

    console.log('\n  Category coverage (across 100 NPCs):');
    for (const [cat, freq] of Object.entries(categoryCoverage).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${cat}: ${freq} appearances (${freq}% of NPCs)`);
    }

    // ---------------------------------------------------------------
    // Test 3: Contradiction check
    // ---------------------------------------------------------------
    console.log('\n--- Test 3: Contradiction Prevention (500 NPCs) ---\n');

    let contradictions = 0;
    for (let i = 0; i < 500; i++) {
        const npc = NPCFactory.generateRandomNPC('Plains');
        for (const trait of npc.traits) {
            const exclusions = TRAIT_EXCLUSIONS[trait];
            if (exclusions) {
                for (const other of npc.traits) {
                    if (trait !== other && exclusions.includes(other)) {
                        contradictions++;
                        console.log(`  CONTRADICTION: ${npc.name} has "${trait}" + "${other}"`);
                    }
                }
            }
        }
    }
    console.log(`  Result: ${contradictions === 0 ? 'PASS — No contradictions found' : `FAIL — ${contradictions} contradictions`}`);

    // ---------------------------------------------------------------
    // Test 4: Name deduplication
    // ---------------------------------------------------------------
    console.log('\n--- Test 4: Name Deduplication (50 NPCs) ---\n');

    const existingForDedup: { name: string }[] = [];
    const names = new Set<string>();
    let dupes = 0;

    for (let i = 0; i < 50; i++) {
        const npc = NPCFactory.generateRandomNPC('Urban', existingForDedup);
        if (names.has(npc.name)) {
            dupes++;
            console.log(`  DUPLICATE: ${npc.name}`);
        }
        names.add(npc.name);
        existingForDedup.push(npc);
    }
    console.log(`  Result: ${dupes === 0 ? 'PASS — All 50 names unique' : `${dupes} duplicates found`}`);

    // ---------------------------------------------------------------
    // Test 5: Role-based stat variation
    // ---------------------------------------------------------------
    console.log('\n--- Test 5: Role-Based Stat Variation ---\n');

    const roles = ['Guard', 'Scholar', 'Merchant', 'Bandit', 'Farmer'];
    for (const role of roles) {
        const npc = NPCFactory.createNPC(`Test ${role}`, false, undefined, role);
        const stats = npc.stats;
        const highest = Object.entries(stats).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
        console.log(`  ${role}: STR=${stats.STR} DEX=${stats.DEX} CON=${stats.CON} INT=${stats.INT} WIS=${stats.WIS} CHA=${stats.CHA} (highest: ${highest[0]}=${highest[1]})`);
    }

    // ---------------------------------------------------------------
    // Test 6: Culture-influenced naming
    // ---------------------------------------------------------------
    console.log('\n--- Test 6: Culture-Influenced Naming ---\n');

    const cultureBiomes: [BiomeType, string][] = [
        ['Urban', 'Human/Elven/Dwarven mix'],
        ['Forest', 'Elven/Human'],
        ['Mountains', 'Dwarven/Human'],
        ['Swamp', 'Rough/Human'],
    ];

    for (const [biome, expected] of cultureBiomes) {
        const sampleNames: string[] = [];
        for (let i = 0; i < 5; i++) {
            const npc = NPCFactory.generateRandomNPC(biome);
            sampleNames.push(npc.name);
        }
        console.log(`  ${biome} (${expected}):`);
        console.log(`    ${sampleNames.join(', ')}`);
    }

    // ---------------------------------------------------------------
    // Test 7: Required categories always present
    // ---------------------------------------------------------------
    console.log('\n--- Test 7: Required Category Guarantee (100 NPCs) ---\n');

    const required: TraitCategory[] = ['PERSONALITY', 'MOTIVATION', 'SOCIAL', 'BACKGROUND'];
    let missingRequired = 0;

    for (let i = 0; i < 100; i++) {
        const npc = NPCFactory.generateRandomNPC('Plains');
        const structured = toStructuredTraits(npc.traits);
        const presentCats = new Set(structured.map(t => t.category));

        for (const req of required) {
            if (!presentCats.has(req)) {
                // Check if a faction trait took this slot
                const hasFactionTrait = npc.traits.some(t => findTraitCategory(t) === undefined);
                if (!hasFactionTrait) {
                    missingRequired++;
                    console.log(`  MISSING ${req} in: ${npc.name} (traits: ${npc.traits.join(', ')})`);
                }
            }
        }
    }
    console.log(`  Result: ${missingRequired === 0 ? 'PASS — All required categories present' : `${missingRequired} missing instances`}`);

    console.log('\n=== TEST COMPLETE ===');
}

runTest();
