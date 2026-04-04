/**
 * Pools of narrative flavor messages for programmatic combat events.
 * Used instead of LLM calls for fast, varied combat narration.
 */

function pick(pool: string[]): string {
    return pool[Math.floor(Math.random() * pool.length)];
}

export const CombatNarrativePool = {
    /** When a companion's order could not be parsed / resolved */
    orderFailed: (companionName: string, playerName: string) => pick([
        `${companionName} couldn't make out ${playerName}'s words over the clash of steel.`,
        `The roar of battle drowned out ${playerName}'s command before ${companionName} could hear it.`,
        `${companionName} glanced toward ${playerName}, confused — the order was lost in the chaos.`,
        `"What?!" ${companionName} shouted, unable to hear ${playerName} over the din of combat.`,
        `${companionName} saw ${playerName}'s lips move, but the meaning was swept away by the wind of battle.`,
        `A crash of metal rang out just as ${playerName} spoke — ${companionName} missed the command entirely.`,
        `${companionName} was too focused on dodging a blow to catch ${playerName}'s order.`,
        `The noise of clashing weapons swallowed ${playerName}'s words before reaching ${companionName}.`,
        `${companionName} shook their head — too much chaos to make sense of ${playerName}'s intent.`,
        `${companionName} flinched as an arrow whistled past, missing ${playerName}'s shouted command.`,
    ]),

    /** When a companion's order was successfully received */
    orderReceived: (companionName: string, behavior: string) => pick([
        `${companionName} nods sharply — understood.`,
        `${companionName} adjusts their stance: ${behavior.toLowerCase()}.`,
        `A look of determination crosses ${companionName}'s face.`,
        `${companionName} acknowledges with a quick gesture.`,
        `${companionName} shifts strategy: ${behavior.toLowerCase()}.`,
    ]),

    /** Companion attacks an enemy */
    companionAttacks: (companionName: string, targetName: string, hit: boolean) => hit ? pick([
        `${companionName} strikes ${targetName} with a decisive blow!`,
        `${companionName}'s weapon finds its mark on ${targetName}!`,
        `${companionName} lands a clean hit on ${targetName}!`,
        `With practiced precision, ${companionName} connects with ${targetName}!`,
    ]) : pick([
        `${companionName} swings at ${targetName} but misses!`,
        `${companionName}'s strike goes wide, missing ${targetName}!`,
        `${targetName} narrowly avoids ${companionName}'s attack!`,
        `${companionName} lunges at ${targetName} but finds only air!`,
    ]),

    /** Companion takes damage */
    companionDamaged: (companionName: string, damage: number) => pick([
        `${companionName} takes ${damage} damage and staggers!`,
        `${companionName} grits their teeth as ${damage} damage lands!`,
        `A hit catches ${companionName} for ${damage} damage!`,
        `${companionName} winces — ${damage} damage taken!`,
    ]),

    /** Companion dodges */
    companionDodges: (companionName: string) => pick([
        `${companionName} takes a defensive stance, ready to dodge.`,
        `${companionName} hunkers down, focusing on evasion.`,
        `${companionName} braces and watches for incoming attacks.`,
    ]),

    /** Companion heals an ally */
    companionHeals: (companionName: string, targetName: string, amount: number) => pick([
        `${companionName} channels healing energy, restoring ${amount} HP to ${targetName}!`,
        `${companionName}'s prayer mends ${targetName}'s wounds for ${amount} HP!`,
        `Warm light flows from ${companionName}'s hands, healing ${targetName} for ${amount} HP!`,
    ]),

    /** Companion falls unconscious */
    companionDowned: (companionName: string) => pick([
        `${companionName} collapses, grievously wounded!`,
        `${companionName} falls to the ground, unconscious!`,
        `${companionName} crumples — they're down!`,
    ]),

    /** Companion death save */
    companionDeathSave: (companionName: string, success: boolean, successes: number, failures: number) => success
        ? `${companionName} clings to life (${successes}/3 successes, ${failures}/3 failures).`
        : `${companionName} slips closer to death (${successes}/3 successes, ${failures}/3 failures)!`,
};
