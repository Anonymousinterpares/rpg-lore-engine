/**
 * StateRenderer — Composes all sub-renderers
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';
import { renderCharacter, renderCharacterCompact } from './CharacterRenderer';
import { renderLocation } from './LocationRenderer';
import { renderInventory } from './InventoryRenderer';
import { renderQuests } from './QuestRenderer';
import { renderMap } from './MapRenderer';

/**
 * Compact one-liner shown after each turn.
 */
export function renderCompact(state: GameState): string {
    const c = state.character;
    const loc = state.location;
    const hex = state.worldMap?.hexes?.[loc.hexId];
    const biome = hex?.biome || '???';
    const time = state.worldTime;
    const h = String(time.hour).padStart(2, '0');
    const m = String(time.minute).padStart(2, '0');
    const weather = state.weather?.type || 'Clear';
    const mode = state.mode;

    return `[${mode}] ${c.name} Lv${c.level} ${c.class} | HP:${c.hp.current}/${c.hp.max} AC:${c.ac} | ${biome} (${loc.coordinates.join(',')}) | ${h}:${m} ${weather}`;
}

/**
 * Full status display.
 */
export function renderFull(state: GameState): string {
    const sections = [
        renderCharacter(state),
        '',
        renderLocation(state),
    ];
    return sections.join('\n');
}

/**
 * Narrative response + compact status.
 */
export function renderNarrative(response: string, state: GameState): string {
    return `${response}\n\n  ${renderCompact(state)}`;
}

// Re-export sub-renderers for direct use
export { renderCharacter, renderCharacterCompact, renderLocation, renderInventory, renderQuests, renderMap };
