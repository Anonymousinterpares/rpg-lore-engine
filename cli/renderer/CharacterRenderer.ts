/**
 * CharacterRenderer — Text-based character sheet display
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;

function mod(score: number): string {
    const m = Math.floor((score - 10) / 2);
    return m >= 0 ? `+${m}` : `${m}`;
}

function hpBar(current: number, max: number, width: number = 20): string {
    const ratio = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(ratio * width);
    const empty = width - filled;
    return `[${'#'.repeat(filled)}${'-'.repeat(empty)}] ${current}/${max}`;
}

function spellSlotDisplay(slots: Record<string, { current: number; max: number }>): string {
    const entries = Object.entries(slots).filter(([_, v]) => v.max > 0);
    if (entries.length === 0) return '';
    return entries.map(([level, v]) => {
        const filled = '*'.repeat(v.current);
        const empty = '-'.repeat(v.max - v.current);
        return `L${level}:[${filled}${empty}]${v.current}/${v.max}`;
    }).join('  ');
}

export function renderCharacter(state: GameState): string {
    const c = state.character;
    const lines: string[] = [];

    lines.push(`  === ${c.name} ===`);
    lines.push(`  Level ${c.level} ${c.race} ${c.class} (${c.sex || 'male'})`);
    lines.push(`  HP: ${hpBar(c.hp.current, c.hp.max)}  AC: ${c.ac}  XP: ${(c as any).xp || 0}`);

    if (c.hp.temp > 0) lines.push(`  Temp HP: ${c.hp.temp}`);

    // Abilities
    const abilityLine = ABILITIES.map(a => {
        const score = c.stats[a] || 10;
        return `${a}:${score}(${mod(score)})`;
    }).join('  ');
    lines.push(`  ${abilityLine}`);

    // Conditions
    if (c.conditions.length > 0) {
        lines.push(`  Conditions: ${c.conditions.map((cd: any) => cd.name || cd).join(', ')}`);
    }

    // Hit Dice
    lines.push(`  Hit Dice: ${c.hitDice.current}/${c.hitDice.max} (${c.hitDice.dieType})`);

    // Spell Slots
    const slotDisplay = spellSlotDisplay(c.spellSlots || {});
    if (slotDisplay) lines.push(`  Spell Slots: ${slotDisplay}`);

    // Cantrips/Spells
    if (c.cantripsKnown?.length > 0) lines.push(`  Cantrips: ${c.cantripsKnown.join(', ')}`);
    if (c.knownSpells?.length > 0) lines.push(`  Known Spells: ${c.knownSpells.join(', ')}`);
    if (c.preparedSpells?.length > 0) lines.push(`  Prepared: ${c.preparedSpells.join(', ')}`);
    if (c.spellbook?.length > 0) lines.push(`  Spellbook: ${c.spellbook.join(', ')}`);

    // Skills
    lines.push(`  Skills: ${c.skillProficiencies.join(', ')}`);

    // Saving Throws
    if (c.savingThrowProficiencies?.length > 0) {
        lines.push(`  Saving Throws: ${c.savingThrowProficiencies.join(', ')}`);
    }

    return lines.join('\n');
}

export function renderCharacterCompact(state: GameState): string {
    const c = state.character;
    return `${c.name} Lv${c.level} ${c.class} | HP:${c.hp.current}/${c.hp.max} AC:${c.ac}`;
}
