/**
 * MapRenderer — ASCII hex map centered on player
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

const BIOME_ABBR: Record<string, string> = {
    'Plains': 'Pl', 'Forest': 'Fo', 'Hills': 'Hi', 'Mountains': 'Mt',
    'Mountain': 'Mt', 'Mountain_High': 'MH', 'Swamp': 'Sw', 'Desert': 'De',
    'Tundra': 'Tu', 'Jungle': 'Ju', 'Coast': 'Co', 'Coast_Cold': 'CC',
    'Coast_Desert': 'CD', 'Ocean': 'Oc', 'Volcanic': 'Vo', 'Ruins': 'Ru',
    'Farmland': 'Fm', 'Urban': 'Ur',
};

/**
 * Render an ASCII hex map centered on the player's current position.
 * Uses axial coordinates (q, r) with offset rendering.
 */
export function renderMap(state: GameState, radius: number = 3): string {
    const [pq, pr] = state.location.coordinates;
    const hexes = state.worldMap?.hexes || {};
    const lines: string[] = [];

    lines.push(`  Map (centered on ${pq},${pr}):`);

    // Scan from top to bottom (r from pr+radius down to pr-radius)
    for (let r = pr + radius; r >= pr - radius; r--) {
        // Offset for hex stagger: odd rows shift right
        const offset = Math.abs(r % 2) === 1 ? '  ' : '';
        let row = '  ' + offset;

        for (let q = pq - radius; q <= pq + radius; q++) {
            const key = `${q},${r}`;
            const hex = hexes[key];

            if (q === pq && r === pr) {
                row += ' @@ ';  // Player position
            } else if (!hex) {
                row += ' .. ';  // Unknown/ungenerated
            } else if (!hex.visited && hex.biome) {
                row += ' ?? ';  // Generated but not visited
            } else if (hex.biome) {
                const abbr = BIOME_ABBR[hex.biome] || hex.biome.slice(0, 2);
                row += ` ${abbr.padEnd(2)} `;
            } else {
                row += ' .. ';
            }
        }

        // Add row coordinate label
        row += `  r=${r}`;
        lines.push(row);
    }

    // Column labels
    let colLabels = '  ' + (Math.abs((pr + radius) % 2) === 1 ? '  ' : '');
    for (let q = pq - radius; q <= pq + radius; q++) {
        colLabels += ` ${String(q).padStart(2)} `;
    }
    lines.push(colLabels);

    // Legend
    lines.push('');
    lines.push('  @@ = You  ?? = Unexplored  .. = Unknown');

    return lines.join('\n');
}
