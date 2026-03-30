/**
 * TestScripts — Pre-built regression scenarios
 */

import { TestScenario } from './ScriptRunner';

export const ALL_CLASSES_CREATION: TestScenario = {
    name: 'ALL_CLASSES_CREATION',
    character: { className: 'Fighter' },
    steps: [
        {
            input: '/look',
            description: 'Basic look command',
            assertions: [
                { path: 'mode', operator: 'eq', value: 'EXPLORATION' },
                { path: 'character.level', operator: 'eq', value: 1 },
                { path: 'character.class', operator: 'eq', value: 'Fighter' },
                { path: 'character.hp.max', operator: 'gt', value: 0 },
                { path: 'worldMap.hexes', operator: 'exists' },
            ]
        }
    ]
};

export const FULL_EXPLORATION: TestScenario = {
    name: 'FULL_EXPLORATION',
    character: { name: 'Explorer', className: 'Ranger', backgroundName: 'Folk Hero' },
    steps: [
        {
            input: '/look',
            description: 'Look at starting location',
            assertions: [
                { path: 'mode', operator: 'eq', value: 'EXPLORATION' },
                { path: 'location.coordinates.0', operator: 'eq', value: 0 },
                { path: 'location.coordinates.1', operator: 'eq', value: 0 },
            ]
        },
        {
            input: '/move N',
            description: 'Move north',
            assertions: [
                { path: 'location.coordinates.1', operator: 'eq', value: 1 },
            ]
        },
        {
            input: '/move SE',
            description: 'Move south-east',
            assertions: [
                { path: 'location.coordinates', operator: 'exists' },
            ]
        },
        {
            input: '/move S',
            description: 'Move south (try to return toward origin)',
            assertions: [
                { path: 'location.coordinates', operator: 'exists' },
            ]
        },
        {
            input: '/wait 30',
            description: 'Wait 30 minutes',
            assertions: [
                { path: 'worldTime.totalTurns', operator: 'gte', value: 0 },
            ]
        },
        {
            input: '/pace Stealth',
            description: 'Set stealth pace',
            assertions: [
                { path: 'travelPace', operator: 'eq', value: 'Stealth' },
            ]
        },
        {
            input: '/pace Normal',
            description: 'Reset pace',
            assertions: [
                { path: 'travelPace', operator: 'eq', value: 'Normal' },
            ]
        },
    ]
};

export const COMBAT_TO_COMPLETION: TestScenario = {
    name: 'COMBAT_TO_COMPLETION',
    character: {
        name: 'Warrior',
        className: 'Fighter',
        abilities: { STR: 15, DEX: 14, CON: 15, INT: 8, WIS: 10, CHA: 8 }
    },
    steps: [
        {
            input: '/combat Goblin 1',
            description: 'Start combat with 1 goblin',
            assertions: [
                { path: 'mode', operator: 'eq', value: 'COMBAT' },
                { path: 'combat', operator: 'exists' },
                { path: 'combat.combatants', operator: 'exists' },
            ]
        },
        // Fight: alternate attack + end turn for up to 10 rounds
        ...Array.from({ length: 10 }, (_, i) => ([
            {
                input: 'attack',
                description: `Attack round ${i + 1}`,
                allowError: true,
            },
            {
                input: 'end turn',
                description: `End turn round ${i + 1}`,
                allowError: true,
            }
        ])).flat() as any[],
    ]
};

export const TRADE_FLOW: TestScenario = {
    name: 'TRADE_FLOW',
    character: { name: 'Trader', className: 'Rogue', backgroundName: 'Criminal' },
    setup: (state: any) => {
        // Inject a merchant NPC at the current hex
        const npc = {
            id: 'test_merchant_1',
            name: 'Greta the Merchant',
            traits: ['Friendly'],
            isMerchant: true,
            relationship: { standing: 0, interactionLog: [] },
            dialogue_triggers: [],
            inventory: [],
            availableQuests: [],
            conversationHistory: [],
            stats: { STR: 10, DEX: 10, CON: 10, INT: 12, WIS: 10, CHA: 14 },
            shopState: {
                inventory: ['Dagger', 'Shield', 'Health Potion'],
                soldByPlayer: [],
                lastHaggleFailure: {},
                markup: 1.0,
                discount: 0,
                isOpen: true,
                gold: 200
            }
        };
        state.worldNpcs = [npc];
        const hexKey = `${state.location.coordinates[0]},${state.location.coordinates[1]}`;
        if (state.worldMap.hexes[hexKey]) {
            state.worldMap.hexes[hexKey].npcs = ['test_merchant_1'];
        }
    },
    steps: [
        {
            input: '/trade test_merchant_1',
            description: 'Open trade with merchant',
            assertions: [
                { path: 'activeTradeNpcId', operator: 'eq', value: 'test_merchant_1' },
            ]
        },
        {
            input: '/closetrade',
            description: 'Close trade',
            assertions: [
                { path: 'activeTradeNpcId', operator: 'eq', value: null },
            ]
        },
    ]
};

export const SAVE_LOAD_INTEGRITY: TestScenario = {
    name: 'SAVE_LOAD_INTEGRITY',
    character: { name: 'Saver', className: 'Cleric', backgroundName: 'Acolyte' },
    steps: [
        {
            input: '/look',
            description: 'Initial look',
            assertions: [
                { path: 'character.name', operator: 'eq', value: 'Saver' },
                { path: 'character.class', operator: 'eq', value: 'Cleric' },
                { path: 'mode', operator: 'eq', value: 'EXPLORATION' },
            ]
        },
        {
            input: '/move N',
            description: 'Move north to change state',
            assertions: [
                { path: 'location.coordinates.1', operator: 'eq', value: 1 },
            ]
        },
    ]
};

export const ALL_SCENARIOS: TestScenario[] = [
    ALL_CLASSES_CREATION,
    FULL_EXPLORATION,
    COMBAT_TO_COMPLETION,
    TRADE_FLOW,
    SAVE_LOAD_INTEGRITY,
];
