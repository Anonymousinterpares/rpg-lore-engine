import { CombatActionResult } from './CombatResolutionEngine';

export class CombatLogFormatter {
    private static templates = {
        HIT: [
            "{attacker} strikes {target} with precision!",
            "{attacker}'s blow lands squarely on {target}.",
            "{attacker} finds an opening and hits {target}.",
            "A successful strike by {attacker} against {target}."
        ],
        MISS: [
            "{attacker} swings at {target} but misses.",
            "{target} narrowly avoids {attacker}'s attack.",
            "{attacker}'s attack deflected by {target}'s defense.",
            "{attacker} overextends and fails to hit {target}."
        ],
        CRIT: [
            "{attacker} delivers a devastating blow to {target}!",
            "A lethal strike from {attacker} catches {target} off guard!",
            "{attacker} scores a massive critical hit on {target}!",
            "Brutality! {attacker} crushes {target} with a critical strike!"
        ],
        RANGED_HIT: [
            "{attacker} fires at {target} and the arrow finds its mark!",
            "{attacker}'s projectile strikes {target} cleanly.",
            "{attacker} looses an arrow that hits {target} with a thud.",
            "A precise shot by {attacker} pierces {target}'s defenses."
        ],
        RANGED_MISS: [
            "{attacker} fires at {target} but the arrow sails past.",
            "{target} ducks as {attacker}'s shot whisks overhead.",
            "{attacker}'s projectile thumps into the ground near {target}.",
            "{attacker} looses a shot but {target} avoids it easily."
        ],
        RANGED_CRIT: [
            "{attacker} looses a perfectly aimed shot that pierces {target}'s vital spot!",
            "Deadly aim! {attacker}'s arrow finds the narrowest gap in {target}'s armor!",
            "{attacker} fires a devastating shot that sends {target} reeling!",
            "Critical hit! {attacker}'s projectile strikes with ultimate precision!"
        ],
        SAVE_SUCCESS: [
            "{target} resists the effects of {attacker}'s spell.",
            "{target} successfully withstands the magical assault.",
            "{target} shrugs off the manifestation of {attacker}'s power.",
            "Magical resistance! {target} is unaffected by the spell."
        ],
        SAVE_FAIL: [
            "{target} fails to resist {attacker}'s magic!",
            "The spell's power overwhelms {target}'s defenses.",
            "{target} is caught in the full force of the magical effect.",
            "{attacker}'s spell takes a heavy toll on {target}."
        ],
        HEAL: [
            "{attacker} mends {target}'s wounds.",
            "Divine light washes over {target}, restoring health.",
            "{target} feels a surge of vitality as wounds close.",
            "Healing energy flows from {attacker} into {target}."
        ]
    };

    /**
     * Formats a combat result into a flavored string
     */
    public static format(result: CombatActionResult, attackerName: string, targetName: string, isRanged: boolean = false): string {
        let type = result.type;
        if (isRanged && (type === 'HIT' || type === 'MISS' || type === 'CRIT')) {
            type = `RANGED_${type}`;
        }

        const pool = this.templates[type as keyof typeof this.templates] || ["{attacker} acted on {target}."];
        const template = pool[Math.floor(Math.random() * pool.length)];

        let msg = template
            .replace(/{attacker}/g, attackerName)
            .replace(/{target}/g, targetName);

        // Add numerical details if relevant
        if (result.damage > 0) {
            msg += ` (${result.damage} damage)`;
        } else if (result.heal > 0) {
            msg += ` (+${result.heal} HP)`;
        }

        return msg;
    }
}
