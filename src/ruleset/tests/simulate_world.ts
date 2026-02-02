import { WorldEnrichmentManager } from '../combat/WorldEnrichmentManager';
import { MechanicsEngine } from '../combat/MechanicsEngine';
import { VisibilityEngine } from '../combat/VisibilityEngine';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import * as fs from 'fs';
import * as path from 'path';

function runWorldSimulation() {
    console.log('--- Starting World Enrichment Simulation ---');

    const manager = new WorldEnrichmentManager(process.cwd());

    // 1. Test NPC Loading
    const npc = manager.loadNPC('elara_innkeeper');
    if (npc) {
        console.log(`Loaded NPC: ${npc.name} (${npc.disposition})`);
        console.log(`Greeting: ${npc.dialogue_triggers[0]}`);
    } else {
        console.error('FAIL: Could not load NPC');
    }

    // 2. Test Sub-Location Loading
    const dungeon = manager.loadSubLocation('old_crypt');
    if (dungeon) {
        console.log(`Loaded Sub-Location: ${dungeon.name} (${dungeon.type})`);
        const room = dungeon.rooms[dungeon.initialRoomId];
        console.log(`Initial Room: ${room.name} - ${room.description}`);
    } else {
        console.error('FAIL: Could not load Sub-Location');
    }

    // 3. Test Hazard Resolution
    if (dungeon) {
        const chamber = dungeon.rooms['burial_chamber'];
        const hazard = chamber.hazards[0];

        // Mock Player
        const pc: any = {
            name: "Galandir",
            level: 1,
            stats: { "CON": 14 },
            skillProficiencies: [],
            savingThrowProficiencies: []
        };

        console.log('\nTesting Hazard Resolution:');
        const res = MechanicsEngine.resolveHazard(pc, hazard);
        console.log(res);
    }

    // 4. Test Visibility
    console.log('\nTesting Visibility Rules:');
    const human: any = { name: "Human", race: "Human", stats: { "WIS": 10 }, skillProficiencies: [], savingThrowProficiencies: [] };
    const elf: any = { name: "Elf", race: "Elf", darkvision: 60, stats: { "WIS": 10 }, skillProficiencies: [], savingThrowProficiencies: [] };

    const vis1 = VisibilityEngine.getVisibilityEffect(human, 'Darkness');
    console.log(`Human in Darkness: Blinded=${vis1.blinded}, Disadvantage=${vis1.disadvantage}`);

    const vis2 = VisibilityEngine.getVisibilityEffect(elf, 'Darkness');
    console.log(`Elf in Darkness: Blinded=${vis2.blinded}, Disadvantage=${vis2.disadvantage}`);

    console.log('\n--- Simulation Finished ---');
}

runWorldSimulation();
