import { CompanionStrategy, CLASS_STRATEGY_MAP, Combatant, CombatState, CombatContext } from './CompanionStrategy';
import { MartialStrategy } from './MartialStrategy';
import { SupportStrategy } from './SupportStrategy';
import { CasterStrategy } from './CasterStrategy';
import { StealthStrategy } from './StealthStrategy';
import { CombatGridManager } from '../grid/CombatGridManager';

const STRATEGIES: Record<string, CompanionStrategy> = {
    martial: new MartialStrategy(),
    support: new SupportStrategy(),
    caster: new CasterStrategy(),
    stealth: new StealthStrategy(),
};

/**
 * Resolves the correct strategy for a companion based on their class.
 */
export function getStrategyForCompanion(actor: Combatant, state: CombatState): CompanionStrategy | null {
    // Try to get class from the tag set during combat initialization
    let className: string | undefined = (actor as any).companionClass;

    // Fallback: infer from prepared spells or stats
    if (!className) {
        if ((actor.preparedSpells || []).some((s: string) => /cure|heal|bless|guidance/i.test(s))) {
            className = 'Cleric';
        } else if ((actor.preparedSpells || []).some((s: string) => /fire bolt|magic missile|eldritch/i.test(s))) {
            className = 'Wizard';
        } else if ((actor.stats['DEX'] || 10) > (actor.stats['STR'] || 10)) {
            className = 'Rogue';
        } else {
            className = 'Fighter';
        }
    }

    const archetype = CLASS_STRATEGY_MAP[className] || 'martial';
    return STRATEGIES[archetype] || null;
}

/**
 * Builds a CombatContext from raw combatant and state.
 */
export function buildCombatContext(actor: Combatant, state: CombatState, grid: CombatGridManager): CombatContext {
    const enemies = state.combatants.filter(c =>
        c.hp.current > 0 && c.type === 'enemy' &&
        !c.conditions?.some?.((cond: any) => (cond.id || cond) === 'Unconscious')
    );
    const allies = state.combatants.filter(c =>
        c.hp.current > 0 &&
        (c.type === 'player' || c.type === 'companion' || c.type === 'summon')
    );
    const player = allies.find(a => a.isPlayer);

    return { actor, enemies, allies, player, grid, state };
}
