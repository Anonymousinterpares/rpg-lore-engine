import { GameState } from '../ruleset/schemas/FullSaveStateSchema';

export const INITIAL_GAME_STATE: GameState = {
    saveId: 'new-chronicle',
    saveVersion: 1,
    createdAt: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
    playTimeSeconds: 0,
    character: {
        name: 'Hero',
        level: 1,
        race: 'Human',
        class: 'Fighter',
        conditions: [],
        stats: { 'STR': 10, 'DEX': 10, 'CON': 10, 'INT': 10, 'WIS': 10, 'CHA': 10 },
        savingThrowProficiencies: [],
        skillProficiencies: [],
        hp: { current: 12, max: 12, temp: 0 },
        deathSaves: { successes: 0, failures: 0 },
        hitDice: { current: 1, max: 1, dieType: '1d10' },
        spellSlots: {},
        cantripsKnown: [],
        knownSpells: [],
        preparedSpells: [],
        spellbook: [],
        ac: 10,
        inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, items: [] },
        equipmentSlots: {},
        attunedItems: [],
        xp: 0,
        inspiration: false,
        biography: {
            background: 'Soldier',
            traits: [],
            ideals: [],
            bonds: [],
            flaws: [],
            chronicles: [
                { turn: 0, event: "The journey begins." }
            ]
        }
    },
    companions: [],
    mode: 'EXPLORATION',
    location: {
        hexId: '0,0',
        coordinates: [0, 0]
    },
    worldTime: { day: 1, hour: 8, month: 1, year: 1489, totalTurns: 0 },
    worldMap: {
        grid_id: 'world_map',
        hexes: {}
    },
    subLocations: [],
    worldNpcs: [],
    activeQuests: [],
    factions: [],
    storySummary: 'A new adventure begins...',
    conversationHistory: [],
    triggeredEvents: [],
    settings: {
        permadeath: false,
        variantEncumbrance: false,
        milestoneLeveling: false,
        criticalFumbleEffects: false,
        difficultyModifier: 1.0,
        inspirationEnabled: true,
        multiclassingAllowed: true,
        maxConversationHistoryTurns: 50
    }
};
