import { Monster } from '../schemas/MonsterSchema';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { CombatantState } from './types';

export class CombatFactory {
    /**
     * Creates a CombatantState from a Monster statblock
     */
    public static fromMonster(monster: Monster, idOverride?: string): CombatantState {
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
            conditions: [],
            isPlayer: false,
            resources: {
                actionSpent: false,
                bonusActionSpent: false,
                reactionSpent: false
            },
            tactical: {
                cover: 'None',
                reach: 5,
                isRanged: false
            },
            spellSlots: monster.spellcasting ? Object.fromEntries(
                Object.entries(monster.spellcasting.slots).map(([lv, data]) => [lv, { current: data.count, max: data.count }])
            ) : undefined,
            preparedSpells: monster.spellcasting ? [
                ...monster.spellcasting.cantrips,
                ...Object.values(monster.spellcasting.slots).flatMap(s => s.spells)
            ] : []
        };
    }

    /**
     * Creates a CombatantState from a Player Character
     */
    public static fromPlayer(pc: PlayerCharacter, idOverride?: string): CombatantState {
        return {
            id: idOverride || `player_${pc.name.toLowerCase().replace(/\s/g, '_')}`,
            name: pc.name,
            hp: { ...pc.hp },
            ac: pc.ac,
            initiative: 0,
            dexterityScore: pc.stats['DEX'] || 10,
            conditions: [],
            isPlayer: true,
            resources: {
                actionSpent: false,
                bonusActionSpent: false,
                reactionSpent: false
            },
            tactical: {
                cover: 'None',
                reach: 5,
                isRanged: false
            },
            spellSlots: JSON.parse(JSON.stringify(pc.spellSlots)),
            preparedSpells: [...pc.cantripsKnown, ...pc.preparedSpells]
        };
    }
}
