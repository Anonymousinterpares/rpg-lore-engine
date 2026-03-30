/**
 * Utility functions for working with the CombatCondition system.
 * Centralizes condition manipulation to avoid scattered push/filter logic.
 */
import { CombatCondition } from '../schemas/CombatSchema';

/**
 * Check if a combatant or character has a specific condition.
 */
export function hasCondition(conditions: CombatCondition[], conditionId: string): boolean {
    return conditions.some(c => c.id === conditionId);
}

/**
 * Add a condition. Prevents duplicates by ID.
 * @param duration - rounds remaining. Omit for permanent (until explicitly removed).
 */
export function addCondition(
    conditions: CombatCondition[],
    id: string,
    sourceId?: string,
    duration?: number,
    description?: string
): void {
    if (hasCondition(conditions, id)) return;
    conditions.push({
        id,
        name: formatConditionName(id),
        description: description || '',
        duration,
        sourceId
    });
}

/**
 * Remove a condition by ID.
 * Returns the new array (also mutates in place for convenience).
 */
export function removeCondition(conditions: CombatCondition[], conditionId: string): CombatCondition[] {
    const idx = conditions.findIndex(c => c.id === conditionId);
    if (idx !== -1) conditions.splice(idx, 1);
    return conditions;
}

/**
 * Tick all condition durations down by 1. Remove expired ones.
 * Returns list of expired condition names for logging.
 */
export function tickConditions(conditions: CombatCondition[]): string[] {
    const expired: string[] = [];
    for (let i = conditions.length - 1; i >= 0; i--) {
        const c = conditions[i];
        if (c.duration !== undefined) {
            c.duration--;
            if (c.duration <= 0) {
                expired.push(c.name);
                conditions.splice(i, 1);
            }
        }
    }
    return expired;
}

/**
 * Get condition names as string array (for display/serialization).
 */
export function conditionNames(conditions: CombatCondition[]): string[] {
    return conditions.map(c => c.name);
}

/**
 * Convert a condition ID like 'Prone' or 'CrossbowExpert' to a display name.
 */
function formatConditionName(id: string): string {
    // Already has spaces or is properly cased
    if (id.includes(' ')) return id;
    // CamelCase to spaced: 'CrossbowExpert' -> 'Crossbow Expert'
    return id.replace(/([a-z])([A-Z])/g, '$1 $2');
}
