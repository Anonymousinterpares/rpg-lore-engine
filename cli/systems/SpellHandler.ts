/**
 * SpellHandler — Spell listing and management
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

export function renderSpells(state: GameState): string {
    const c = state.character;
    const lines: string[] = ['  === Spells ==='];

    if (c.cantripsKnown?.length > 0) {
        lines.push(`  Cantrips: ${c.cantripsKnown.join(', ')}`);
    }

    if (c.knownSpells?.length > 0) {
        lines.push(`  Known Spells: ${c.knownSpells.join(', ')}`);
    }

    if (c.preparedSpells?.length > 0) {
        lines.push(`  Prepared: ${c.preparedSpells.join(', ')}`);
    }

    if (c.spellbook?.length > 0) {
        lines.push(`  Spellbook: ${c.spellbook.join(', ')}`);
    }

    // Spell Slots
    const slots = c.spellSlots || {};
    const slotEntries = Object.entries(slots).filter(([_, v]: any) => v.max > 0);
    if (slotEntries.length > 0) {
        lines.push('  Spell Slots:');
        for (const [level, v] of slotEntries) {
            const filled = '*'.repeat((v as any).current);
            const empty = '-'.repeat((v as any).max - (v as any).current);
            lines.push(`    Level ${level}: [${filled}${empty}] ${(v as any).current}/${(v as any).max}`);
        }
    }

    if (lines.length === 1) {
        lines.push('  No spellcasting ability.');
    }

    return lines.join('\n');
}
