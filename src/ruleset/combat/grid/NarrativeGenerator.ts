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
        const targetName = target ? ('name' in target ? target.name : ('type' in target ? (biomeData.features[target.type] || target.type) : 'the location')) : '';
        const distText = distance ? `${distance * 5}ft` : '';
        const remainingText = combatant && target && 'x' in target && 'y' in target
            ? ` (${(distance || 0) * 5}ft move, ${Math.max(0, (Math.ceil(Math.sqrt(Math.pow(target.x - combatant.position.x, 2) + Math.pow(target.y - combatant.position.y, 2))) - (distance || 0)) * 5)}ft remaining)`
            : distText;

        switch (templateId) {
            // Category A: Aggression
            case 'charge':
                return {
                    label: `Charge!`,
                    description: `Charge headlong at the ${targetName}!${remainingText}`
                };
            case 'stalk':
                return {
                    label: `Stalk`,
                    description: `Creep through the ${biomeData.dangerTier === 'Safe' ? 'undergrowth' : 'shadows'} towards ${targetName}.${remainingText}`
                };
            case 'press':
                return {
                    label: `Press the Attack`,
                    description: `Close in on ${targetName}, maintaining pressure and denying retreat.`
                };

            // Category B: Supportive / Formation
            case 'phalanx':
                return {
                    label: `Form Phalanx`,
                    description: `Move shoulder-to-shoulder with ${targetName} for mutual protection.`
                };
            case 'flank':
                return {
                    label: `Flank`,
                    description: `Circle around ${targetName} to catch them between you and your ally.`
                };

            // Category C: Defensive
            case 'hunker_down':
                return {
                    label: `Hunker Down`,
                    description: `Take cover behind the ${targetName}, bracing for incoming fire.`
                };

            // Category D: Retreat
            case 'fade_back':
                return {
                    label: `Fade Back`,
                    description: `Retreat ${distText} away from the melee.`
                };
            case 'vanish':
                return {
                    label: `Vanish`,
                    description: `Use the ${weather.type === 'Fog' ? 'fog' : 'chaos of battle'} to disappear from sight.`
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
