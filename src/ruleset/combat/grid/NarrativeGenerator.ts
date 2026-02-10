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
        distance?: number
    ): { label: string, description: string } {
        const biomeData = BIOME_TACTICAL_DATA[biome] || BIOME_TACTICAL_DATA['Forest'];
        const targetName = target ? ('name' in target ? target.name : ('type' in target ? (biomeData.features[target.type] || target.type) : 'the location')) : '';
        const distText = distance ? `${distance * 5}ft` : '';

        switch (templateId) {
            // Category A: Aggression
            case 'charge':
                return {
                    label: `Charge!`,
                    description: `Charge headlong at the ${targetName}! (${distText})`
                };
            case 'cautious_advance':
                return {
                    label: `Cautious Advance`,
                    description: `Advance on ${targetName}, keeping cover between you.`
                };
            case 'stalk':
                return {
                    label: `Stalk`,
                    description: `Creep through the ${biomeData.dangerTier === 'Safe' ? 'undergrowth' : 'shadows'} towards ${targetName}.`
                };
            case 'intercept':
                return {
                    label: `Intercept`,
                    description: `Move to cut off ${targetName}'s path.`
                };
            case 'rush':
                return {
                    label: `Rush`,
                    description: `Dash to close the gap with ${targetName}!`
                };
            case 'press':
                return {
                    label: `Press the Attack`,
                    description: `Step in and pressure the ${targetName}.`
                };

            // Category B: Positioning
            case 'hunker_down':
                return {
                    label: `Hunker Down`,
                    description: `Dive behind the ${targetName} ${relativeDir} for safety.`
                };
            case 'high_ground':
                return {
                    label: `High Ground`,
                    description: `Scramble atop the ${targetName} to gain the advantage.`
                };
            case 'corner_peek':
                return {
                    label: `Corner Peek`,
                    description: `Peek around the edge of the ${targetName} to spot ${relativeDir} targets.`
                };
            case 'obstruction':
                return {
                    label: `Obstruct`,
                    description: `Put the ${targetName} between you and the threat.`
                };
            case 'bunker':
                return {
                    label: `Bunker`,
                    description: `Fortify your position behind the ${targetName}.`
                };

            // Category C: Teamwork
            case 'flank':
                return {
                    label: `Flank`,
                    description: `Circle ${relativeDir} to flank ${targetName} with your ally.`
                };
            case 'pincer':
                return {
                    label: `Pincer Maneuver`,
                    description: `Coordinate a pincer move on ${targetName}.`
                };
            case 'encircle':
                return {
                    label: `Encircle`,
                    description: `Spread out to the ${relativeDir} of ${targetName}.`
                };
            case 'backstab':
                return {
                    label: `Backstab`,
                    description: `Slip into the blind spot behind the ${targetName}.`
                };
            case 'phalanx':
                return {
                    label: `Phalanx`,
                    description: `Form up shoulder-to-shoulder with ${targetName}.`
                };
            case 'bait':
                return {
                    label: `Bait`,
                    description: `Hold position to lure the enemy closer.`
                };
            case 'rescue':
                return {
                    label: `Rescue`,
                    description: `Interpose yourself between your ally and the ${targetName}.`
                };

            // Category D: Retreat
            case 'fade_back':
                return {
                    label: `Fade Back`,
                    description: `Retreat ${distText} away from the melee.`
                };
            case 'withdraw':
                return {
                    label: `Tactical Withdrawal`,
                    description: `Tactical withdrawal to the ${targetName ?? 'rear'}.`
                };
            case 'kite':
                return {
                    label: `Kite`,
                    description: `Keep distance while eyeing the ${targetName}.`
                };
            case 'vanish':
                return {
                    label: `Vanish`,
                    description: `Melt into the ${weather.type === 'Fog' ? 'mist' : 'shadows'}.`
                };
            case 'regroup':
                return {
                    label: `Regroup`,
                    description: `Retreat towards ${targetName}.`
                };
            case 'scramble':
                return {
                    label: `Scramble`,
                    description: `Run for the ${relativeDir} edge of the area!`
                };

            default:
                return {
                    label: templateId,
                    description: `Execute ${templateId} strategy.`
                };
        }
    }
}
