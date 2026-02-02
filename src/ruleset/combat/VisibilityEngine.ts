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

        let darkvision = 0;
        if ('darkvision' in observer) {
            darkvision = (observer as any).darkvision || 0;
        } else if ('race' in observer) {
            // Need to look up race trait, but for now we check a hidden property 
            // or assume some races have it.
        }

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
