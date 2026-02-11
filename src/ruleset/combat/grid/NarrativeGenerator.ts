import { Combatant, GridPosition, TerrainFeature } from '../../schemas/CombatSchema';
import { Weather } from '../../schemas/BaseSchemas';
import { BIOME_TACTICAL_DATA } from '../BiomeRegistry';

export class NarrativeGenerator {
    /**
     * Translates a tactical intent into a rich narrative description.
     */
    public static generate(
        templateId: string,
        combatant: Combatant,
        target: Combatant | TerrainFeature | GridPosition | null,
        biome: string,
        weather: Weather,
        relativeDir: string,
        distance?: number,
        resultDistance?: number
    ): { label: string, description: string } {
        const biomeData = BIOME_TACTICAL_DATA[biome] || BIOME_TACTICAL_DATA['Forest'];
        let targetName = '';
        if (target) {
            if ('name' in target && typeof (target as any).name === 'string') {
                targetName = (target as any).name;
            } else if ('type' in target && 'position' in target) {
                // TerrainFeature resolution
                const tf = target as TerrainFeature;
                const variants = biomeData.features[tf.type] || [];
                if (Array.isArray(variants) && variants.length > 0) {
                    const x = tf.position?.x ?? 0;
                    const y = tf.position?.y ?? 0;
                    const hash = Math.abs(x * 31 + y);
                    const variant = variants[hash % variants.length];
                    targetName = variant?.name || tf.type;
                } else {
                    targetName = tf.type;
                }
            } else {
                targetName = 'the location';
            }
        }

        const distText = distance ? `${distance * 5}ft` : '';
        const remainingText = combatant && target && 'x' in target && 'y' in target
            ? ` (${(distance || 0) * 5}ft move, ${Math.max(0, (Math.ceil(Math.sqrt(Math.pow(target.x - combatant.position.x, 2) + Math.pow(target.y - combatant.position.y, 2))) - (distance || 0)) * 5)}ft remaining)`
            : distText;

        switch (templateId) {
            // Category A: Aggression
            case 'charge':
                return {
                    label: `Charge!`,
                    description: `Charge headlong at ${targetName}! ⚡ 2× move, −2 AC.`
                };
            case 'stalk':
                return {
                    label: `Stalk`,
                    description: `Creep through the undergrowth towards ${targetName}. 🤫 ½ speed, Stealth check → Advantage if unseen.`
                };
            case 'press':
                return {
                    label: `Press the Attack`,
                    description: `Close in on ${targetName}, maintaining pressure and denying retreat. ⚔️ Advantage on next melee. ½ movement.`
                };

            // Category B: Supportive / Formation
            case 'phalanx':
                return {
                    label: `Phalanx Formation`,
                    description: `Move shoulder-to-shoulder with your ally. 🛡️ +1 AC mutual. AoE vulnerable.`
                };
            case 'flank':
                return {
                    label: `Flank Enemy`,
                    description: `Circle around ${targetName} to strike from a vulnerable angle. ⚔️ Melee Advantage while flanking.`
                };

            // Category C: Defensive
            case 'hunker_down':
                const movePrefix = distance && distance > 0 ? `Move ${distance * 5}ft and take` : 'Take';
                return {
                    label: `Hunker Down`,
                    description: `${movePrefix} cover behind the ${targetName}, bracing for incoming fire. 🛡️ Cover bonus depends on feature.`
                };

            // Category D: Retreat
            case 'fade_back':
                return {
                    label: `Fade Back`,
                    description: `Retreat ${distText} away from danger while staying oriented to the enemy. ⚠️ Provokes Opportunity Attacks.`
                };
            case 'vanish':
                return {
                    label: `Vanish`,
                    description: `Use the fog to disappear from view. 🤫 Hide action vs Perception.`
                };

            // Category E: Environmental Awareness (Informational)
            case 'cover_awareness':
                return {
                    label: `Cover Spotted`,
                    description: `A ${targetName} provides ${relativeDir} cover ${distText} away.`
                };

            default:
                return {
                    label: templateId,
                    description: `Execute ${templateId} strategy. ${distText}`
                };
        }
    }
}
