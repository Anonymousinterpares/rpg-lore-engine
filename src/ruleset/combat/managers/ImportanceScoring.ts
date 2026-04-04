import { GameState } from '../../schemas/FullSaveStateSchema';
import { TRAIT_TOPIC_KEYWORDS, CHATTER_TRAIT_MODIFIERS } from '../../schemas/ConversationSchema';
import { ConversationMessage } from '../../schemas/ConversationSchema';

/**
 * MMAgents-inspired multi-signal importance scoring for group conversation routing.
 *
 * Each companion gets scored 0-20+ based on 18 signals across 4 tiers.
 * Highest score responds. Ties (within 1 point) broken randomly.
 *
 * Signals:
 * Tier 1 (Hard): direct name address, adjacency obligation, unconscious block
 * Tier 2 (Competence): class expertise, role expertise, trait resonance, inventory match, background
 * Tier 3 (Personality): extroversion, emotional trigger, relationship, recent speaker, wounded, merchant
 * Tier 4 (Context): time mood, post-combat, question boost, disagreement seed
 */

interface CompanionData {
    id: string;
    name: string;
    class: string;
    role?: string;
    traits: string[];
    hp: { current: number; max: number };
    standing: number;
    equippedWeapon?: string;
    equippedArmor?: string;
    preparedSpells?: string[];
    cantrips?: string[];
    gold: number;
}

interface ScoringContext {
    input: string;
    conversationHistory: ConversationMessage[];
    worldTimeHour: number;
    recentCombat: boolean;
}

// Class → expertise domain keywords
const CLASS_EXPERTISE: Record<string, string[]> = {
    'Fighter':   ['fight', 'combat', 'battle', 'weapon', 'armor', 'sword', 'shield', 'war', 'tactics', 'defend', 'attack', 'melee', 'strength', 'train'],
    'Barbarian': ['fight', 'rage', 'strength', 'battle', 'wild', 'fury', 'smash', 'charge'],
    'Paladin':   ['fight', 'holy', 'oath', 'divine', 'protect', 'justice', 'smite', 'righteous'],
    'Ranger':    ['track', 'hunt', 'nature', 'wild', 'beast', 'forest', 'trail', 'scout', 'bow', 'arrow', 'terrain', 'survival'],
    'Rogue':     ['sneak', 'stealth', 'shadow', 'lock', 'trap', 'steal', 'thief', 'hide', 'poison', 'dagger', 'trick', 'lie'],
    'Wizard':    ['magic', 'spell', 'arcane', 'lore', 'book', 'study', 'know', 'history', 'rune', 'scroll', 'enchant', 'ritual', 'learn', 'research'],
    'Warlock':   ['magic', 'pact', 'patron', 'dark', 'eldritch', 'curse', 'hex', 'power', 'otherworldly'],
    'Sorcerer':  ['magic', 'innate', 'power', 'wild', 'surge', 'bloodline'],
    'Cleric':    ['heal', 'cure', 'divine', 'god', 'pray', 'temple', 'bless', 'faith', 'holy', 'undead', 'spirit', 'wound', 'hurt', 'injured'],
    'Druid':     ['nature', 'animal', 'plant', 'forest', 'wild', 'beast', 'weather', 'storm', 'grow', 'earth', 'moon', 'tree'],
    'Bard':      ['song', 'story', 'tale', 'inspire', 'music', 'charm', 'persuade', 'negotiate', 'entertain', 'lore', 'legend'],
    'Monk':      ['discipline', 'meditation', 'ki', 'balance', 'inner', 'peace', 'martial', 'punch', 'calm'],
};

// Role → expertise domain keywords (supplements class)
const ROLE_EXPERTISE: Record<string, string[]> = {
    'Guard':     ['safe', 'danger', 'patrol', 'watch', 'protect', 'threat', 'secure', 'duty', 'order'],
    'Scholar':   ['know', 'read', 'study', 'book', 'lore', 'history', 'learn', 'research', 'ancient'],
    'Merchant':  ['buy', 'sell', 'trade', 'gold', 'coin', 'price', 'value', 'market', 'goods', 'profit', 'deal'],
    'Hermit':    ['alone', 'solitude', 'wilderness', 'quiet', 'meditate', 'spirit'],
    'Bandit':    ['ambush', 'road', 'steal', 'loot', 'outlaw', 'gang'],
    'Hunter':    ['track', 'prey', 'hunt', 'animal', 'trail', 'bow'],
    'Scout':     ['ahead', 'scout', 'report', 'watch', 'terrain', 'map'],
    'Farmer':    ['crop', 'harvest', 'field', 'farm', 'grow', 'land', 'food'],
    'Noble':     ['politics', 'court', 'noble', 'lord', 'lady', 'rule', 'diplomacy', 'house'],
    'Druid':     ['forest', 'nature', 'grove', 'sacred', 'ritual'],
    'Cultist':   ['ritual', 'dark', 'sacrifice', 'forbidden', 'secret'],
};

// Extroversion modifiers (from CHATTER_TRAIT_MODIFIERS but as +/- scores)
const EXTROVERSION_SCORES: Record<string, number> = {
    'Gossip': 3, 'Charismatic': 3, 'Charming': 2, 'Flamboyant': 3,
    'Inquisitive': 2, 'Cheerful': 2, 'Optimistic': 1, 'Eccentric': 2,
    'Sarcastic': 1, 'Aggressive': 1,
    'Loner': -2, 'Reclusive': -2, 'Stoic': -2, 'Apathetic': -2,
    'Detached': -1, 'Cold': -1, 'Guarded': -1, 'Humble': -1,
};

// Emotional trigger: motivation traits → triggering keywords
const EMOTIONAL_TRIGGERS: Record<string, string[]> = {
    'Greed (Gold)':         ['gold', 'treasure', 'coin', 'rich', 'wealth', 'fortune', 'pay', 'reward', 'loot', 'valuable'],
    'Glory (Fame)':         ['fame', 'glory', 'hero', 'legend', 'name', 'renown', 'brave', 'deed'],
    'Revenge (Past)':       ['revenge', 'past', 'wrong', 'enemy', 'betray', 'justice', 'punish', 'hurt'],
    'Knowledge (Secrets)':  ['secret', 'hidden', 'mystery', 'discover', 'truth', 'reveal', 'ancient', 'forbidden'],
    'Faith (Divine)':       ['god', 'divine', 'prayer', 'temple', 'holy', 'faith', 'bless', 'curse', 'evil'],
    'Survival (Fear)':      ['danger', 'safe', 'survive', 'fear', 'escape', 'die', 'death', 'careful'],
    'Love (Family)':        ['family', 'home', 'child', 'parent', 'love', 'protect', 'care'],
    'Duty (Honor)':         ['duty', 'honor', 'oath', 'protect', 'serve', 'loyal', 'defend'],
    'Chaos (Freedom)':      ['freedom', 'rule', 'law', 'rebel', 'break', 'chains', 'wild'],
    'Redemption (Guilt)':   ['forgive', 'atone', 'guilt', 'mistake', 'sorry', 'redeem', 'past'],
    'Power (Control)':      ['power', 'control', 'command', 'rule', 'dominate', 'lead', 'authority'],
    'Boredom (Adventure)':  ['adventure', 'explore', 'exciting', 'boring', 'thrill', 'discover', 'new'],
};

// Disagreement seed: trait → words that would provoke the opposite reaction
const DISAGREEMENT_SEEDS: Record<string, string[]> = {
    'Lawful':     ['steal', 'cheat', 'lie', 'flee', 'abandon', 'ignore the rules'],
    'Chaotic':    ['rules', 'law', 'order', 'obey', 'submit', 'authority'],
    'Good':       ['kill innocent', 'abandon', 'cruel', 'evil', 'betray'],
    'Evil':       ['mercy', 'forgive', 'spare', 'charity', 'help them'],
    'Honest':     ['lie', 'cheat', 'deceive', 'trick', 'pretend'],
    'Suspicious': ['trust them', 'believe', 'follow blindly', 'go along with it'],
    'Aggressive': ['flee', 'run', 'hide', 'retreat', 'surrender', 'give up'],
    'Humble':     ['boast', 'brag', 'show off', 'i am the best'],
};

/**
 * Calculates importance score for a single companion in a group conversation.
 * Higher score = more likely to respond.
 */
export function calculateImportanceScore(
    companion: CompanionData,
    ctx: ScoringContext,
    allParticipantIds: string[]
): { score: number; signals: string[] } {
    const input = ctx.input.toLowerCase();
    const words = input.replace(/[^a-z'\s-]/g, '').split(/\s+/).filter(w => w.length > 1);
    let score = 0;
    const signals: string[] = [];

    // === TIER 1: HARD SIGNALS ===

    // Signal 1: Direct name address (+9)
    // Checks: exact match, prefix (≥3 chars), Levenshtein ≤ 2, substring
    const firstName = companion.name.split(' ')[0].toLowerCase();
    const lastName = companion.name.split(' ').slice(1).join(' ').toLowerCase();
    const nameInInput = words.some(w => {
        if (w.length < 2) return false;
        // Exact match
        if (w === firstName) return true;
        // Prefix match (humans naturally abbreviate: "Gard" for "Gardain", "Grim" for "Grimjaw")
        if (w.length >= 3 && firstName.startsWith(w)) return true;
        if (w.length >= 3 && w.startsWith(firstName)) return true;
        // Prefix-with-typo: compare input word against the same-length prefix of the name
        // e.g., "Garrd" (5 chars) vs "Garda" (first 5 chars of "Gardain") → Levenshtein 1
        if (w.length >= 3 && w.length < firstName.length) {
            const namePrefix = firstName.substring(0, w.length);
            if (levenshtein(w, namePrefix) <= 1) return true;
        }
        // Levenshtein fuzzy match on full name
        if (levenshtein(w, firstName) <= 2) return true;
        // Last name match (exact or prefix)
        if (lastName && (w === lastName || (w.length >= 3 && lastName.startsWith(w)))) return true;
        return false;
    });
    if (nameInInput) {
        score += 9;
        signals.push(`name(+9)`);
    }

    // Signal 2: Adjacency obligation (+8) — previous speaker asked this companion something
    if (ctx.conversationHistory.length > 0) {
        const lastMsg = ctx.conversationHistory[ctx.conversationHistory.length - 1];
        if (lastMsg.speakerId !== companion.id && lastMsg.speakerId !== 'player') {
            // Check if previous speaker mentioned this companion's name
            if (lastMsg.text.toLowerCase().includes(firstName)) {
                score += 8;
                signals.push(`addressed(+8)`);
            }
        }
    }

    // Signal 3: Unconscious block
    if (companion.hp.current <= 0) {
        return { score: -999, signals: ['unconscious(-∞)'] };
    }

    // === TIER 2: COMPETENCE SIGNALS ===

    // Signal 4: Class expertise domain (+5)
    const classKeywords = CLASS_EXPERTISE[companion.class] || [];
    const classMatches = words.filter(w => classKeywords.includes(w)).length;
    if (classMatches > 0) {
        const bonus = Math.min(5, classMatches * 2);
        score += bonus;
        signals.push(`class(+${bonus})`);
    }

    // Signal 5: Role expertise (+4)
    const roleKeywords = ROLE_EXPERTISE[companion.role || ''] || [];
    const roleMatches = words.filter(w => roleKeywords.includes(w)).length;
    if (roleMatches > 0) {
        const bonus = Math.min(4, roleMatches * 2);
        score += bonus;
        signals.push(`role(+${bonus})`);
    }

    // Signal 6: Trait-topic resonance (+3)
    let traitScore = 0;
    for (const trait of companion.traits) {
        const keywords = TRAIT_TOPIC_KEYWORDS[trait] || [];
        for (const word of words) {
            if (keywords.includes(word)) traitScore++;
        }
    }
    if (traitScore > 0) {
        const bonus = Math.min(3, traitScore);
        score += bonus;
        signals.push(`trait(+${bonus})`);
    }

    // Signal 7: Inventory/equipment match (+4/+6 for specific match)
    const mentionsWeapon = /sword|weapon|blade|bow|dagger|axe|mace|staff|spear|hammer|armed|wield/.test(input);
    const mentionsArmor = /armor|mail|leather|plate|shield|protect|defence|defend/.test(input);
    const mentionsSpell = /spell|magic|cast|heal|cure/.test(input);

    if (mentionsWeapon && companion.equippedWeapon) {
        // Check if the SPECIFIC weapon is mentioned (e.g., "sword" matches "Longsword")
        const weaponLower = companion.equippedWeapon.toLowerCase();
        const specificMatch = words.some(w => weaponLower.includes(w) || w.includes(weaponLower.split(' ')[0]));
        if (specificMatch) {
            score += 6; // Specific weapon match
            signals.push(`weaponMatch(+6:${companion.equippedWeapon})`);
        } else {
            score += 3; // Has a weapon but not the specific one mentioned
            signals.push(`hasWeapon(+3)`);
        }
    } else if (mentionsWeapon && !companion.equippedWeapon) {
        score -= 2; // Penalty — they are unarmed
        signals.push(`noWeapon(-2)`);
    }

    if (mentionsArmor && companion.equippedArmor) {
        score += 3;
        signals.push(`hasArmor(+3)`);
    }

    if (mentionsSpell && companion.preparedSpells && companion.preparedSpells.length > 0) {
        score += 4;
        signals.push(`hasSpells(+4)`);
    } else if (mentionsSpell && (!companion.preparedSpells || companion.preparedSpells.length === 0)) {
        score -= 2;
        signals.push(`noSpells(-2)`);
    }

    // Signal 8: Background trait match (+3)
    const backgroundTraits = ['Ex-Soldier', 'Failed Wizard', 'Noble Scion', 'Escaped Convict',
        'Retired Adventurer', 'Farmer', 'Orphan', 'Cultist', 'Merchant', 'Artisan',
        'Hermit', 'Dockworker', 'Scholar', 'Mercenary'];
    for (const trait of companion.traits) {
        if (backgroundTraits.includes(trait)) {
            const bgKeywords = ROLE_EXPERTISE[trait] || TRAIT_TOPIC_KEYWORDS[trait] || [];
            if (words.some(w => bgKeywords.includes(w))) {
                score += 3;
                signals.push(`background(+3)`);
                break;
            }
        }
    }

    // === TIER 3: PERSONALITY/SOCIAL SIGNALS ===

    // Signal 9: Extroversion factor (+3/−2)
    let extroversion = 0;
    for (const trait of companion.traits) {
        extroversion += EXTROVERSION_SCORES[trait] || 0;
    }
    extroversion = Math.max(-2, Math.min(3, extroversion));
    if (extroversion !== 0) {
        score += extroversion;
        signals.push(`extro(${extroversion > 0 ? '+' : ''}${extroversion})`);
    }

    // Signal 10: Emotional trigger (+4)
    for (const trait of companion.traits) {
        const triggers = EMOTIONAL_TRIGGERS[trait];
        if (triggers && words.some(w => triggers.includes(w))) {
            score += 4;
            signals.push(`emotion(+4:${trait})`);
            break;
        }
    }

    // Signal 11: Relationship enthusiasm (+2)
    if (companion.standing > 50) {
        score += 2;
        signals.push(`loyal(+2)`);
    } else if (companion.standing < 0) {
        score -= 1;
        signals.push(`hostile(-1)`);
    }

    // Signal 12: Recent speaker penalty (−3)
    const recentSpeakers = ctx.conversationHistory.slice(-2).map(m => m.speakerId);
    if (recentSpeakers.includes(companion.id)) {
        score -= 3;
        signals.push(`recentSpoke(-3)`);
    }

    // Signal 13: Wounded dampening (−2)
    const hpRatio = companion.hp.current / companion.hp.max;
    const askedAboutHealth = /health|wound|hurt|injured|okay|fine|feeling|heal/.test(input);
    if (hpRatio < 0.3 && !askedAboutHealth) {
        score -= 2;
        signals.push(`wounded(-2)`);
    } else if (hpRatio < 0.3 && askedAboutHealth) {
        score += 3; // Actually MORE likely to respond if asked about their wounds
        signals.push(`woundedAsked(+3)`);
    }

    // Signal 14: Merchant instinct (+3)
    const merchantTopics = /buy|sell|trade|gold|coin|price|value|market|goods|profit|deal/.test(input);
    if (merchantTopics && (companion.role === 'Merchant' || companion.traits.includes('Greed (Gold)'))) {
        score += 3;
        signals.push(`merchant(+3)`);
    }

    // === TIER 4: CONTEXTUAL SIGNALS ===

    // Signal 15: Time-of-day mood (±1)
    const isNight = ctx.worldTimeHour >= 22 || ctx.worldTimeHour < 5;
    const reflectiveTraits = ['Melancholic', 'Mysterious', 'Stoic', 'Humble'];
    const energeticTraits = ['Cheerful', 'Optimistic', 'Flamboyant', 'Aggressive'];
    if (isNight && companion.traits.some(t => reflectiveTraits.includes(t))) {
        score += 1;
        signals.push(`nightMood(+1)`);
    }
    if (!isNight && ctx.worldTimeHour >= 6 && ctx.worldTimeHour < 12 && companion.traits.some(t => energeticTraits.includes(t))) {
        score += 1;
        signals.push(`morningMood(+1)`);
    }

    // Signal 16: Post-combat boost (+2)
    if (ctx.recentCombat) {
        const isMartial = ['Fighter', 'Barbarian', 'Paladin', 'Ranger'].includes(companion.class);
        if (isMartial) {
            score += 2;
            signals.push(`postCombat(+2)`);
        }
    }

    // Signal 17: Question detection (+1)
    const isQuestion = input.includes('?') || /^(who|what|where|when|why|how|can|do|does|is|are|should|could|would)\b/.test(input);
    if (isQuestion) {
        score += 1;
        signals.push(`question(+1)`);
    }

    // Signal 18: Disagreement seed (+2)
    for (const trait of companion.traits) {
        const seeds = DISAGREEMENT_SEEDS[trait];
        if (seeds && seeds.some(s => input.includes(s))) {
            score += 2;
            signals.push(`disagree(+2:${trait})`);
            break;
        }
    }

    return { score, signals };
}

/**
 * Selects the best responder from a list of participants using importance scoring.
 * Returns the companion ID of the highest scorer. Ties broken randomly.
 */
export function selectResponder(
    participantIds: string[],
    state: GameState,
    input: string,
    conversationHistory: ConversationMessage[]
): { responderId: string; scores: Record<string, { score: number; signals: string[] }> } {
    const ctx: ScoringContext = {
        input,
        conversationHistory,
        worldTimeHour: state.worldTime.hour,
        recentCombat: state.conversationHistory
            .slice(-5)
            .some(h => /battle|combat|fought|fled/.test((h as any).content?.toLowerCase() || '')),
    };

    const scores: Record<string, { score: number; signals: string[] }> = {};
    let bestId = participantIds[0];
    let bestScore = -999;

    for (const id of participantIds) {
        const companion = state.companions.find((c: any) => c.meta?.sourceNpcId === id);
        if (!companion) continue;

        const char = companion.character;
        const meta = companion.meta;
        const slots = char.equipmentSlots || {};

        const resolveItemName = (slotId: string | undefined): string | undefined => {
            if (!slotId) return undefined;
            const item = char.inventory?.items?.find((i: any) => i.instanceId === slotId);
            return item ? (item as any).name : undefined;
        };

        const data: CompanionData = {
            id,
            name: char.name,
            class: char.class,
            role: meta.originalRole,
            traits: meta.originalTraits || [],
            hp: { current: char.hp.current, max: char.hp.max },
            standing: meta.companionStanding || 25,
            equippedWeapon: resolveItemName((slots as any).mainHand),
            equippedArmor: resolveItemName((slots as any).armor),
            preparedSpells: char.preparedSpells?.length > 0 ? char.preparedSpells : undefined,
            cantrips: char.cantripsKnown?.length > 0 ? char.cantripsKnown : undefined,
            gold: char.inventory?.gold?.gp || 0,
        };

        const result = calculateImportanceScore(data, ctx, participantIds);
        scores[id] = result;

        // Tie-breaking: within 1 point, add random factor
        const effectiveScore = result.score + (Math.random() * 0.9);

        if (effectiveScore > bestScore) {
            bestScore = effectiveScore;
            bestId = id;
        }
    }

    console.log(`[ImportanceScoring] Scores: ${Object.entries(scores).map(([id, s]) => {
        const name = state.companions.find((c: any) => c.meta?.sourceNpcId === id)?.character.name || id;
        return `${name}=${s.score} [${s.signals.join(', ')}]`;
    }).join(' | ')}`);

    return { responderId: bestId, scores };
}

/** Simple Levenshtein distance */
function levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const m: number[][] = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            m[i][j] = Math.min(m[i-1][j]+1, m[i][j-1]+1, m[i-1][j-1] + (b[i-1]===a[j-1]?0:1));
        }
    }
    return m[b.length][a.length];
}
