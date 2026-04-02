import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Monster } from '../schemas/MonsterSchema';

export type LightLevel = 'Bright' | 'Dim' | 'Darkness';

export class VisibilityEngine {
    /**
     * Determines visibility status for an observer looking at a target
     */
    public static getVisibilityEffect(
        observer: PlayerCharacter | Monster,
        currentLight: LightLevel
    ): { disadvantage: boolean; blinded: boolean } {

        const darkvision = (observer as any).darkvision || 0;

        if (currentLight === 'Darkness') {
            if (darkvision > 0) return { disadvantage: true, blinded: false };
            return { disadvantage: false, blinded: true };
        }

        if (currentLight === 'Dim') {
            if (darkvision > 0) return { disadvantage: false, blinded: false };
            return { disadvantage: true, blinded: false };
        }

        return { disadvantage: false, blinded: false };
    }
}
