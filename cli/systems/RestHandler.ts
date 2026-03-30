/**
 * RestHandler — Enhanced rest display
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

export function renderRestSummary(stateBefore: GameState, stateAfter: GameState, type: 'short' | 'long'): string {
    const before = stateBefore.character;
    const after = stateAfter.character;
    const lines: string[] = [`  === ${type === 'long' ? 'Long' : 'Short'} Rest Complete ===`];

    const hpDelta = after.hp.current - before.hp.current;
    if (hpDelta > 0) {
        lines.push(`  HP restored: +${hpDelta} (${before.hp.current} -> ${after.hp.current}/${after.hp.max})`);
    } else {
        lines.push(`  HP: ${after.hp.current}/${after.hp.max} (no change)`);
    }

    const hdDelta = after.hitDice.current - before.hitDice.current;
    if (hdDelta > 0) {
        lines.push(`  Hit Dice restored: +${hdDelta} (${after.hitDice.current}/${after.hitDice.max})`);
    }

    // Spell slots
    const beforeSlots = before.spellSlots || {};
    const afterSlots = after.spellSlots || {};
    for (const level of Object.keys(afterSlots)) {
        const bSlot = (beforeSlots as any)[level];
        const aSlot = (afterSlots as any)[level];
        if (aSlot && bSlot && aSlot.current > bSlot.current) {
            lines.push(`  Spell Slot L${level}: +${aSlot.current - bSlot.current} (${aSlot.current}/${aSlot.max})`);
        }
    }

    return lines.join('\n');
}
