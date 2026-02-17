import { BiomeType } from '../schemas/BiomeSchema';

// Biome → item pool (DataManager keys as found in data/item/*.json)
export const MERCHANT_POOLS: Record<string, string[]> = {
    'Urban': [
        'Longsword', 'Shield', 'Chain_mail', 'Breastplate', 'Crossbow__light',
        'Crossbow_bolt', 'Pouch', 'Lantern__hooded', 'Oil__flask_', 'Healer_s_kit',
        'Abacus', 'Book', 'Ink__1_ounce_bottle_', 'Parchment__one_sheet_', 'Spyglass'
    ],
    'Farmland': [
        'Sickle', 'Pitchfork', 'Club', 'Basket', 'Rope__hempen__50_feet_',
        'Wheelbarrow', 'Shovel', 'Pot__iron', 'Soap', 'Common_clothes'
    ],
    'Plains': [
        'Spear', 'Shortbow', 'Arrow', 'Bedroll', 'Mess_kit', 'Waterskin',
        'Rations__1_day_', 'Tent__two-person', 'Horse__riding', 'Saddle__riding'
    ],
    'Forest': [
        'Handaxe', 'Shortbow', 'Arrow', 'Herbalism_kit', 'Antitoxin__vial_',
        'Hunting_trap', 'Net', 'Quiver', 'Leather_armor', 'Druid_s_focus__totem_'
    ],
    'Jungle': [
        'Machete', 'Blowgun', 'Blowgun_needle', 'Poisoner_s_kit', 'Torch',
        'Rations__1_day_', 'Insect_repellent', 'Canoe'
    ],
    'Hills': [
        'Pickaxe', 'Hammer', 'Climbing_kit', 'Grappling_hook', 'Crowbar',
        'Backpack', 'Mess_kit', 'Goat', 'Hide_armor'
    ],
    'Mountains': [
        'Pickaxe', 'Maul', 'Climbing_kit', 'Cold_weather_outfit', 'Block_and_tackle',
        'Pitons__10_', 'Rope__silk__50_feet_', 'Ram__portable'
    ],
    'Coast': [
        'Trident', 'Net', 'Fishing_tackle', 'Oil__flask_', 'Lantern__hooded',
        'Spyglass', 'Navigator_s_tools', 'Boat__rowing'
    ],
    'Ocean': [
        'Trident', 'Net', 'Navigator_s_tools', 'Spyglass', 'Compass', 'Sextant'
    ],
    'Swamp': [
        'Spear', 'Net', 'Poisoner_s_kit', 'Antitoxin__vial_', 'Boat__rowing',
        'Torch', 'Caltrops'
    ],
    'Desert': [
        'Scimitar', 'Waterskin', 'Tent__two-person', 'Camel', 'Blanket',
        'Hourglass', 'Mirror__steel', 'Soap'
    ],
    'Tundra': [
        'Handaxe', 'Spear', 'Cold_weather_outfit', 'Bedroll', 'Mess_kit',
        'Oil__flask_', 'Lantern__hooded', 'Sled'
    ],
    'Underdark': [
        'War_pick', 'Hand_crossbow', 'Crossbow_bolt', 'Poisoner_s_kit',
        'Lantern__bullseye', 'Oil__flask_', 'Spider_silk_rope'
    ]
};

// Common items every merchant stocks regardless of biome
export const COMMON_ITEMS = [
    'Rations__1_day_',
    'Torch',
    'Waterskin',
    'Rope__hempen__50_feet_',
    'Bedroll',
    'Tinderbox'
];

/**
 * Biome commerce configuration.
 * goldDice: GP reserves roll (e.g. '4d20+40')
 * itemDice: Number of random items from pool to pick (e.g. '2d6+3' -> 5-15)
 */
export interface BiomeCommerceConfig {
    goldDice: string;
    itemDice: string;
}

export const BIOME_COMMERCE: Record<string, BiomeCommerceConfig> = {
    'Urban': { goldDice: '4d20+80', itemDice: '2d6+3' },  // 84-160gp, 5-15 items
    'Farmland': { goldDice: '3d10+30', itemDice: '1d8+4' },  // 33-60gp, 5-12 items
    'Plains': { goldDice: '2d10+20', itemDice: '1d6+4' },  // 22-40gp, 5-10 items
    'Forest': { goldDice: '2d8+15', itemDice: '1d6+3' },  // 17-31gp, 4-9 items
    'Jungle': { goldDice: '2d8+15', itemDice: '1d6+3' },
    'Hills': { goldDice: '2d8+20', itemDice: '1d6+4' },
    'Coast': { goldDice: '2d10+30', itemDice: '1d8+3' },
    'Mountains': { goldDice: '1d10+10', itemDice: '1d4+4' },  // 11-20gp, 5-8 items
    'Swamp': { goldDice: '1d8+5', itemDice: '1d4+3' },  // 6-13gp, 4-7 items
    'Desert': { goldDice: '2d10+15', itemDice: '1d4+4' },
    'Tundra': { goldDice: '1d8+10', itemDice: '1d4+3' },
    'Ocean': { goldDice: '2d10+20', itemDice: '1d6+2' },
    'Underdark': { goldDice: '3d12+20', itemDice: '1d8+4' }
};

export const DEFAULT_COMMERCE: BiomeCommerceConfig = {
    goldDice: '2d10+10',
    itemDice: '1d6+4'
};
