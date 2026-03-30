/**
 * LocationRenderer — Current hex info, time, weather, NPCs
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

const MONTH_NAMES: Record<number, string> = {
    1: 'Hammer', 2: 'Alturiak', 3: 'Ches', 4: 'Tarsakh',
    5: 'Mirtul', 6: 'Kythorn', 7: 'Flamerule', 8: 'Eleasis',
    9: 'Eleint', 10: 'Marpenoth', 11: 'Uktar', 12: 'Nightal'
};

export function renderLocation(state: GameState): string {
    const loc = state.location;
    const hex = state.worldMap?.hexes?.[loc.hexId];
    const time = state.worldTime;
    const lines: string[] = [];

    // Location
    const biome = hex?.biome || '???';
    const name = hex?.name || 'Unknown';
    lines.push(`  Location: ${name} (${biome})`);
    lines.push(`  Coordinates: (${loc.coordinates.join(', ')})`);

    if (hex?.description) {
        lines.push(`  ${hex.description}`);
    }

    // Time
    const h = String(time.hour).padStart(2, '0');
    const m = String(time.minute).padStart(2, '0');
    const monthName = MONTH_NAMES[time.month] || `Month ${time.month}`;
    lines.push(`  Time: Day ${time.day}, ${h}:${m} (${monthName}, ${time.year})`);

    // Weather
    const weather = state.weather?.type || 'Clear';
    lines.push(`  Weather: ${weather}`);

    // Travel Pace
    lines.push(`  Pace: ${state.travelPace || 'Normal'}`);

    // NPCs at location
    if (hex?.npcs?.length > 0) {
        const npcNames = hex.npcs.map((npcId: string) => {
            const npc = state.worldNpcs.find((n: any) => n.id === npcId);
            return npc ? `${npc.name}${npc.isMerchant ? ' [Merchant]' : ''}` : npcId;
        });
        lines.push(`  NPCs: ${npcNames.join(', ')}`);
    }

    // Points of Interest
    if (hex?.interest_points?.length > 0) {
        const pois = hex.interest_points.filter((p: any) => p.discovered);
        if (pois.length > 0) {
            lines.push(`  Points of Interest:`);
            pois.forEach((p: any) => lines.push(`    - ${p.name}`));
        }
    }

    // Dropped items
    if (loc.droppedItems?.length > 0) {
        lines.push(`  Dropped Items: ${loc.droppedItems.map((i: any) => i.name).join(', ')}`);
    }
    if (loc.combatLoot?.length > 0) {
        lines.push(`  Combat Loot: ${loc.combatLoot.map((i: any) => i.name).join(', ')}`);
    }

    return lines.join('\n');
}
