/**
 * Calculate effective stat values including temporary modifiers from statusEffects.
 * Returns the bonus (positive or negative) for each stat.
 */

interface StatusEffect {
    stat?: string;
    modifier?: number | string;
    type: 'BUFF' | 'DEBUFF';
}

export interface StatBonus {
    value: number;  // The modifier amount (+5, -2, etc.)
    sources: string[]; // Names of effects contributing
}

export function getACBonus(statusEffects: StatusEffect[]): StatBonus {
    let value = 0;
    const sources: string[] = [];
    for (const eff of statusEffects) {
        if (eff.stat === 'ac' && typeof eff.modifier === 'number') {
            value += eff.modifier;
            sources.push((eff as any).name || eff.stat);
        }
    }
    return { value, sources };
}

export function getStatBonus(statusEffects: StatusEffect[], stat: string): StatBonus {
    let value = 0;
    const sources: string[] = [];
    for (const eff of statusEffects) {
        if (eff.stat === stat && typeof eff.modifier === 'number') {
            value += eff.modifier;
            sources.push((eff as any).name || eff.stat);
        }
    }
    return { value, sources };
}

export function getAllStatBonuses(statusEffects: StatusEffect[]): Record<string, StatBonus> {
    const result: Record<string, StatBonus> = {};
    for (const eff of statusEffects) {
        if (eff.stat && typeof eff.modifier === 'number') {
            if (!result[eff.stat]) result[eff.stat] = { value: 0, sources: [] };
            result[eff.stat].value += eff.modifier;
            result[eff.stat].sources.push((eff as any).name || eff.stat);
        }
    }
    return result;
}
