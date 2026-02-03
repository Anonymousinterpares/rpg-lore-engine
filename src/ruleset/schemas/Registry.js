import { SpellSchema } from './SpellSchema';
import { RaceSchema } from './RaceSchema';
import { ClassSchema } from './ClassSchema';
import { ItemSchema } from './ItemSchema';
import { MonsterSchema } from './MonsterSchema';
import { MechanicsSchema } from './MechanicsSchema';
import { PlayerCharacterSchema } from './PlayerCharacterSchema';
/**
 * The RulebookRegistry acts as a central hub for all strictly-typed game data.
 * This is the foundation of the "VibeCoding" hallucination-proof strategy.
 */
export const RulebookRegistry = {
    spell: SpellSchema,
    race: RaceSchema,
    class: ClassSchema,
    item: ItemSchema,
    monster: MonsterSchema,
    mechanics: MechanicsSchema,
    character: PlayerCharacterSchema
};
