import { Monster } from '../schemas/MonsterSchema';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { CombatantState } from './types';
import { CombatUtils } from './CombatUtils';
import { DataManager } from '../data/DataManager';

export class CombatFactory {
    /**
     * Creates a CombatantState from a Monster statblock
     */
    public static fromMonster(monster: Monster, idOverride?: string): CombatantState {
        const tactical = this.calculateMonsterTactics(monster);

        return {
            id: idOverride || `monster_${Math.random().toString(36).substr(2, 9)}`,
            name: monster.name,
            hp: {
                current: monster.hp.average,
                max: monster.hp.average,
                temp: 0
            },
            ac: monster.ac,
            initiative: 0,
            dexterityScore: monster.stats['DEX'] || 10,
            type: 'enemy',
            stats: monster.stats as Record<string, number>,
            conditions: [],
            statusEffects: [],
            isPlayer: false,
            resources: {
                actionSpent: false,
                bonusActionSpent: false,
                reactionSpent: false
            },
            tactical,
            spellSlots: monster.spellcasting ? Object.fromEntries(
                Object.entries(monster.spellcasting.slots).map(([lv, data]) => [lv, { current: data.count, max: data.count }])
            ) : undefined,
            preparedSpells: monster.spellcasting ? [
                ...monster.spellcasting.cantrips,
                ...Object.values(monster.spellcasting.slots).flatMap(s => s.spells)
            ] : [],

            // Spatial Defaults
            position: { x: 0, y: 0 },
            size: monster.size || 'Medium',
            movementSpeed: 6, // 30ft / 5 = 6 cells
            movementRemaining: 6
        };
    }

    private static calculateMonsterTactics(monster: Monster) {
        let maxReach = 5; // ft
        let isRanged = false;
        let normalRange = 0;
        let longRange = 0;

        (monster.actions || []).forEach(action => {
            const desc = action.description.toLowerCase();
            const name = action.name.toLowerCase();

            // 1. Check for melee reach (e.g., "reach 10 ft.")
            const reachMatch = desc.match(/reach\s+(\d+)\s*ft/);
            if (reachMatch) {
                const r = parseInt(reachMatch[1], 10);
                if (r > maxReach) maxReach = r;
            }

            // 2. Check for ranged weapon/spell attack and parse range
            // Pattern: "range 80/320 ft."
            const rangeMatch = desc.match(/range\s+(\d+)\/(\d+)\s*ft/);
            if (rangeMatch) {
                const n = parseInt(rangeMatch[1], 10);
                const l = parseInt(rangeMatch[2], 10);
                if (n > normalRange) {
                    normalRange = n;
                    longRange = l;
                }
                isRanged = true;
            } else {
                // Pattern: "range 60 ft."
                const singleRangeMatch = desc.match(/range\s+(\d+)\s*ft/);
                if (singleRangeMatch) {
                    const r = parseInt(singleRangeMatch[1], 10);
                    if (r > normalRange) {
                        normalRange = r;
                        longRange = r;
                    }
                    isRanged = true;
                }
            }

            if (!isRanged && (desc.includes('ranged weapon attack') || desc.includes('ranged spell attack'))) {
                isRanged = true;
            }

            // 3. Fallback to name keywords
            if (name.includes('bow') || name.includes('sling') || name.includes('crossbow') || name.includes('bolt') || name.includes('net')) {
                isRanged = true;
                if (normalRange === 0) {
                    // Generic fallbacks if parsing failed
                    normalRange = 30;
                    longRange = 120;
                }
            }
        });

        return {
            cover: 'None' as const,
            reach: maxReach,
            isRanged: isRanged,
            range: isRanged ? { normal: normalRange, long: longRange } : undefined
        };
    }

    /**
     * Creates a CombatantState from a Player Character
     */
    public static fromPlayer(pc: PlayerCharacter, idOverride?: string): CombatantState {
        const tactical = this.calculatePlayerTactics(pc);

        return {
            id: idOverride || 'player',
            name: pc.name,
            hp: { ...pc.hp },
            ac: pc.ac,
            initiative: 0,
            dexterityScore: pc.stats['DEX'] || 10,
            type: 'player',
            stats: pc.stats as Record<string, number>,
            conditions: [],
            statusEffects: [],
            isPlayer: true,
            resources: {
                actionSpent: false,
                bonusActionSpent: false,
                reactionSpent: false
            },
            tactical,
            spellSlots: JSON.parse(JSON.stringify(pc.spellSlots)),
            preparedSpells: [...pc.cantripsKnown, ...pc.preparedSpells],

            // Spatial Defaults
            position: { x: 0, y: 0 },
            size: 'Medium',
            movementSpeed: 6,
            movementRemaining: 6
        };
    }

    private static calculatePlayerTactics(pc: PlayerCharacter) {
        let maxReach = 5; // ft
        let isRanged = false;
        let range: { normal: number; long: number } | undefined = undefined;

        const mainHandId = pc.equipmentSlots.mainHand;
        if (mainHandId) {
            const item = pc.inventory.items.find(i => i.instanceId === mainHandId);
            if (item) {
                // Fetch full definition in case instance data is incomplete
                const def = DataManager.getItem(item.id) as any;
                const fullItem = { ...def, ...item };

                isRanged = CombatUtils.isRangedWeapon(fullItem);

                if (isRanged && fullItem.range) {
                    range = {
                        normal: fullItem.range.normal,
                        long: fullItem.range.long || fullItem.range.normal
                    };
                }

                // Melee reach check
                if (fullItem.properties && (
                    fullItem.properties.includes('Reach') ||
                    fullItem.properties.some((p: string) => p.toLowerCase().includes('reach'))
                )) {
                    maxReach = 10;
                }
            }
        }

        return {
            cover: 'None' as const,
            reach: maxReach,
            isRanged: isRanged,
            range
        };
    }
}
