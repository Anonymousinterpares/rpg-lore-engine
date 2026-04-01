/**
 * DifficultyEngine — Provides scaling factors for Easy/Normal/Hard modes.
 * Data-driven from data/config/difficulty.json. Flip-of-switch design.
 */

export type DifficultyLevel = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
    label: string;
    description: string;
    enemyStatScale: number;
    enemyHPScale: number;
    enemyDamageScale: number;
    xpScale: number;
}

// Loaded at runtime from difficulty.json
let configs: Record<DifficultyLevel, DifficultyConfig> = {
    easy: { label: 'Easy', description: '', enemyStatScale: 0.75, enemyHPScale: 0.75, enemyDamageScale: 0.8, xpScale: 0.75 },
    normal: { label: 'Normal', description: '', enemyStatScale: 1.0, enemyHPScale: 1.0, enemyDamageScale: 1.0, xpScale: 1.0 },
    hard: { label: 'Hard', description: '', enemyStatScale: 1.25, enemyHPScale: 1.5, enemyDamageScale: 1.2, xpScale: 1.25 },
};

export class DifficultyEngine {

    /**
     * Load difficulty configs from parsed JSON data.
     */
    static loadConfigs(data: Record<string, any>): void {
        for (const key of ['easy', 'normal', 'hard'] as DifficultyLevel[]) {
            if (data[key]) configs[key] = data[key] as DifficultyConfig;
        }
    }

    /**
     * Get the config for a difficulty level.
     */
    static getConfig(difficulty: DifficultyLevel): DifficultyConfig {
        return configs[difficulty] || configs.normal;
    }

    /**
     * Get the difficulty level from game state settings.
     */
    static getDifficulty(state: any): DifficultyLevel {
        return state?.settings?.difficulty || 'normal';
    }

    /**
     * Scale a value by the specified factor for the current difficulty.
     */
    static scaleEnemyHP(baseHP: number, difficulty: DifficultyLevel): number {
        const scaled = Math.round(baseHP * configs[difficulty].enemyHPScale);
        // Guarantee at least ±1 difference from base for non-normal difficulties
        if (difficulty === 'easy' && scaled >= baseHP) return Math.max(1, baseHP - 1);
        if (difficulty === 'hard' && scaled <= baseHP) return baseHP + 1;
        return Math.max(1, scaled);
    }

    static scaleEnemyStat(baseStat: number, difficulty: DifficultyLevel): number {
        return Math.max(1, Math.round(baseStat * configs[difficulty].enemyStatScale));
    }

    static scaleEnemyDamage(baseDamage: number, difficulty: DifficultyLevel): number {
        return Math.max(1, Math.round(baseDamage * configs[difficulty].enemyDamageScale));
    }

    static scaleXP(baseXP: number, difficulty: DifficultyLevel): number {
        return Math.max(0, Math.round(baseXP * configs[difficulty].xpScale));
    }

    /**
     * Rescale a combatant's HP proportionally when difficulty changes mid-combat.
     * Preserves the current/max HP ratio.
     */
    static rescaleCombatantHP(combatant: any, oldDifficulty: DifficultyLevel, newDifficulty: DifficultyLevel): void {
        if (combatant.isPlayer) return; // Don't scale player HP
        const oldScale = configs[oldDifficulty].enemyHPScale;
        const newScale = configs[newDifficulty].enemyHPScale;
        if (oldScale === newScale) return;

        const ratio = combatant.hp.current / combatant.hp.max;
        const baseHP = Math.round(combatant.hp.max / oldScale);
        combatant.hp.max = Math.max(1, Math.round(baseHP * newScale));
        combatant.hp.current = Math.max(1, Math.round(combatant.hp.max * ratio));
    }
}
