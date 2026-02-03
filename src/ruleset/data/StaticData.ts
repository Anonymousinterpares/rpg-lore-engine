import { BiomeDefinition } from '../schemas/BiomeSchema';
import { Recipe } from '../schemas/RecipeSchema';
import { LLMProviderConfig } from '../schemas/LLMProviderSchema';

export const LLM_PROVIDERS: LLMProviderConfig[] = [
    {
        "id": "gemini",
        "name": "Google Gemini",
        "apiKeyEnvVar": "GEMINI_API_KEY",
        "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
        "models": [
            { "id": "gemini-3-0-flash", "apiName": "gemini-3-flash-preview", "displayName": "Gemini 3.0 Flash", "contextWindow": 1000000, "costPer1kTokens": 0.0001 },
            { "id": "gemini-3-0-pro", "apiName": "gemini-3-pro", "displayName": "Gemini 3.0 Pro", "contextWindow": 2000000, "costPer1kTokens": 0.00125 }
        ]
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "apiKeyEnvVar": "OPENAI_API_KEY",
        "baseUrl": "https://api.openai.com/v1",
        "models": [
            { "id": "gpt-5-nano", "apiName": "gpt-5-nano", "displayName": "GPT-5 Nano", "contextWindow": 400000, "costPer1kTokens": 0.00005 },
            { "id": "gpt-4.1-nano", "apiName": "gpt-4.1-nano", "displayName": "GPT-4.1 Nano", "contextWindow": 1000000, "costPer1kTokens": 0.0001 },
            { "id": "gpt-5-mini", "apiName": "gpt-5-mini", "displayName": "GPT-5 Mini", "contextWindow": 400000, "costPer1kTokens": 0.00025 }
        ]
    },
    {
        "id": "anthropic",
        "name": "Anthropic Claude",
        "apiKeyEnvVar": "ANTHROPIC_API_KEY",
        "baseUrl": "https://api.anthropic.com/v1",
        "models": [
            { "id": "claude-4-5-haiku", "apiName": "claude-4-5-haiku", "displayName": "Claude 4.5 Haiku", "contextWindow": 200000, "costPer1kTokens": 0.00025 },
            { "id": "claude-4-5-sonnet", "apiName": "claude-4-5-sonnet", "displayName": "Claude 4.5 Sonnet", "contextWindow": 200000, "costPer1kTokens": 0.003 },
            { "id": "claude-4-5-opus", "apiName": "claude-4-5-opus", "displayName": "Claude 4.5 Opus", "contextWindow": 200000, "costPer1kTokens": 0.015 }
        ]
    },
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "apiKeyEnvVar": "OPENROUTER_API_KEY",
        "baseUrl": "https://openrouter.ai/api/v1",
        "models": [
            { "id": "mistral-7b", "apiName": "mistralai/mistral-7b-instruct", "displayName": "Mistral 7B", "contextWindow": 32000, "costPer1kTokens": 0.00007 },
            { "id": "llama-3-8b", "apiName": "meta-llama/llama-3-8b-instruct", "displayName": "Llama 3 8B", "contextWindow": 8000, "costPer1kTokens": 0.00005 },
            { "id": "nous-hermes-2", "apiName": "nousresearch/nous-hermes-2-mixtral", "displayName": "Nous Hermes 2", "contextWindow": 32000, "costPer1kTokens": 0.0002 },
            { "id": "gemma-2-9b", "apiName": "google/gemma-2-9b-it", "displayName": "Gemma 2 9B", "contextWindow": 8000, "costPer1kTokens": 0.00005 },
            { "id": "qwen-2-7b", "apiName": "qwen/qwen-2-7b-instruct", "displayName": "Qwen 2 7B", "contextWindow": 32000, "costPer1kTokens": 0.00005 }
        ]
    }
];

export const BIOME_DEFINITIONS: BiomeDefinition[] = [
    {
        "id": "Plains",
        "displayName": "Plains",
        "travelSpeedModifier": 1.0,
        "encounterRateModifier": 1.0,
        "baseAppearanceWeight": 25,
        "adjacencyModifiers": { "Plains": 10, "Forest": 5, "Farmland": 10 },
        "maxClusterSize": 10,
        "clusterPenaltyMultiplier": 0.2
    },
    {
        "id": "Forest",
        "displayName": "Forest",
        "travelSpeedModifier": 0.8,
        "encounterRateModifier": 1.5,
        "baseAppearanceWeight": 20,
        "adjacencyModifiers": { "Forest": 30, "Plains": 5, "Hills": 5, "Swamp": 10 },
        "maxClusterSize": 8,
        "clusterPenaltyMultiplier": 0.2
    },
    {
        "id": "Hills",
        "displayName": "Hills",
        "travelSpeedModifier": 0.7,
        "encounterRateModifier": 1.2,
        "baseAppearanceWeight": 15,
        "adjacencyModifiers": { "Hills": 15, "Mountains": 10, "Plains": 5 },
        "maxClusterSize": 6,
        "clusterPenaltyMultiplier": 0.3
    },
    {
        "id": "Mountains",
        "displayName": "Mountains",
        "travelSpeedModifier": 0.5,
        "encounterRateModifier": 1.5,
        "baseAppearanceWeight": 10,
        "adjacencyModifiers": { "Mountains": 25, "Hills": 15 },
        "maxClusterSize": 5,
        "clusterPenaltyMultiplier": 0.3
    },
    {
        "id": "Swamp",
        "displayName": "Swamp",
        "travelSpeedModifier": 0.4,
        "encounterRateModifier": 2.0,
        "baseAppearanceWeight": 8,
        "adjacencyModifiers": { "Swamp": 15, "Forest": 10, "Ocean": 5 },
        "maxClusterSize": 4,
        "clusterPenaltyMultiplier": 0.2
    },
    {
        "id": "Desert",
        "displayName": "Desert",
        "travelSpeedModifier": 0.6,
        "encounterRateModifier": 1.1,
        "baseAppearanceWeight": 5,
        "adjacencyModifiers": { "Desert": 40, "Mountains": 5 },
        "maxClusterSize": 10,
        "clusterPenaltyMultiplier": 0.5
    },
    {
        "id": "Coast",
        "displayName": "Coast",
        "travelSpeedModifier": 0.9,
        "encounterRateModifier": 1.0,
        "baseAppearanceWeight": 5,
        "adjacencyModifiers": { "Ocean": 50, "Coast": 20, "Plains": 5 },
        "maxClusterSize": 15,
        "clusterPenaltyMultiplier": 0.4
    },
    {
        "id": "Ocean",
        "displayName": "Ocean",
        "travelSpeedModifier": 1.0,
        "encounterRateModifier": 0.5,
        "baseAppearanceWeight": 0,
        "adjacencyModifiers": { "Ocean": 100, "Coast": 30 },
        "maxClusterSize": 1000,
        "clusterPenaltyMultiplier": 1.0
    }
];

export const BIOME_RESOURCES = [
    { "biome": "Plains", "resources": [{ "itemId": "Raw_Hide", "weight": 40 }, { "itemId": "Kingsbloom", "weight": 30 }, { "itemId": "Oak_Logs", "weight": 10 }, { "itemId": "Iron_Ore", "weight": 5 }] },
    { "biome": "Forest", "resources": [{ "itemId": "Pine_Logs", "weight": 30 }, { "itemId": "Oak_Logs", "weight": 30 }, { "itemId": "Raw_Hide", "weight": 15 }, { "itemId": "Silverleaf", "weight": 15 }, { "itemId": "Bogbean", "weight": 5 }, { "itemId": "Iron_Ore", "weight": 5 }] },
    { "biome": "Mountains", "resources": [{ "itemId": "Iron_Ore", "weight": 40 }, { "itemId": "Silver_Ore", "weight": 20 }, { "itemId": "Thick_Hide", "weight": 15 }, { "itemId": "Coal", "weight": 10 }, { "itemId": "Mithril_Ore", "weight": 5 }, { "itemId": "Gold_Ore", "weight": 5 }] },
    { "biome": "Swamp", "resources": [{ "itemId": "Bogbean", "weight": 40 }, { "itemId": "Nightshade", "weight": 30 }, { "itemId": "Oak_Logs", "weight": 10 }, { "itemId": "Raw_Hide", "weight": 5 }] },
    { "biome": "Desert", "resources": [{ "itemId": "Gold_Ore", "weight": 30 }, { "itemId": "Desert_Rose", "weight": 20 }, { "itemId": "Coal", "weight": 10 }, { "itemId": "Iron_Ore", "weight": 5 }] },
    { "biome": "Tundra", "resources": [{ "itemId": "Thick_Hide", "weight": 50 }, { "itemId": "Pine_Logs", "weight": 30 }, { "itemId": "Iron_Ore", "weight": 5 }] },
    { "biome": "Jungle", "resources": [{ "itemId": "Ironwood", "weight": 30 }, { "itemId": "Silverleaf", "weight": 20 }, { "itemId": "Thick_Hide", "weight": 20 }, { "itemId": "Kingsbloom", "weight": 10 }, { "itemId": "Iron_Ore", "weight": 5 }] }
];

export const RECIPES: Recipe[] = [
    {
        "id": "recipe_buckler",
        "name": "Buckler",
        "resultItemId": "Buckler",
        "ingredients": [{ "itemId": "Iron_Ore", "quantity": 1 }, { "itemId": "Leather_Strips", "quantity": 1 }],
        "toolRequired": "Smith's Tools",
        "skillCheck": { "skill": "Athletics", "dc": 10 },
        "timeDays": 1
    },
    {
        "id": "recipe_round_shield",
        "name": "Round Shield",
        "resultItemId": "Round_Shield",
        "ingredients": [{ "itemId": "Oak_Logs", "quantity": 2 }, { "itemId": "Iron_Ore", "quantity": 1 }],
        "toolRequired": "Smith's Tools",
        "skillCheck": { "skill": "Athletics", "dc": 10 },
        "timeDays": 2
    },
    {
        "id": "recipe_kite_shield",
        "name": "Kite Shield",
        "resultItemId": "Kite_Shield",
        "ingredients": [{ "itemId": "Iron_Ore", "quantity": 2 }, { "itemId": "Oak_Logs", "quantity": 1 }],
        "toolRequired": "Smith's Tools",
        "skillCheck": { "skill": "Athletics", "dc": 12 },
        "timeDays": 2
    },
    {
        "id": "recipe_tower_shield",
        "name": "Tower Shield",
        "resultItemId": "Tower_Shield",
        "ingredients": [{ "itemId": "Iron_Ore", "quantity": 4 }, { "itemId": "Oak_Logs", "quantity": 2 }, { "itemId": "Leather_Strips", "quantity": 2 }],
        "toolRequired": "Smith's Tools",
        "skillCheck": { "skill": "Athletics", "dc": 15 },
        "timeDays": 4
    },
    {
        "id": "recipe_potion_healing",
        "name": "Potion of Healing",
        "resultItemId": "Potion_of_healing",
        "ingredients": [{ "itemId": "Silverleaf", "quantity": 1 }, { "itemId": "Bogbean", "quantity": 1 }, { "itemId": "Glass_Vial", "quantity": 1 }],
        "toolRequired": "Herbalism Kit",
        "skillCheck": { "skill": "Medicine", "dc": 12 },
        "timeDays": 1
    },
    {
        "id": "recipe_leather_armor",
        "name": "Leather Armor",
        "resultItemId": "Leather",
        "ingredients": [{ "itemId": "Raw_Hide", "quantity": 3 }, { "itemId": "Leather_Strips", "quantity": 2 }],
        "toolRequired": "Leatherworker's Tools",
        "skillCheck": { "skill": "Sleight of Hand", "dc": 10 },
        "timeDays": 2
    }
];

export const WEAPON_ACTION_MAPPING: Record<string, string> = {
    "Club": "Club",
    "Dagger": "Dagger",
    "Shortsword": "Shortsword",
    "Light Crossbow": "Crossbow__light",
    "Warhammer": "Warhammer",
    "Longsword": "Longsword",
    "Whip": "Whip",
    "Scimitar": "Scimitar",
    "Glaive": "Glaive",
    "Greataxe": "Greataxe",
    "Morningstar": "Morningstar",
    "Javelin": "Javelin",
    "Pike": "Pike",
    "Longbow": "Longbow",
    "War Pick": "War_pick",
    "Poisoned Dart": "Dart",
    "Mace": "Mace",
    "Hand Crossbow": "Hand_crossbow",
    "Quarterstaff": "Quarterstaff",
    "Battleaxe": "Battleaxe",
    "Greatsword": "Greatsword",
    "Spear": "Spear",
    "Shortbow": "Shortbow",
    "Spiked Bone Club": "Club",
    "Heavy Crossbow": "Crossbow__heavy",
    "Greatclub": "Greatclub",
    "Fork": "Trident",
    "Sword": "Longsword",
    "Sling": "Sling",
    "Heavy Club": "Greatclub",
    "Harpoon": "Javelin",
    "Rapier": "Rapier",
    "Slaying Longbow": "Longbow",
    "Flying Sword": "Longsword",
    "Greataxe (Humanoid or Hybrid Form Only)": "Greataxe",
    "Maul (Humanoid or Hybrid Form Only)": "Maul",
    "Shortsword (Humanoid or Hybrid Form Only)": "Shortsword",
    "Hand Crossbow (Humanoid or Hybrid Form Only)": "Hand_crossbow",
    "Scimitar (Humanoid or Hybrid Form Only)": "Scimitar",
    "Longbow (Humanoid or Hybrid Form Only)": "Longbow",
    "Spear (Humanoid Form Only)": "Spear"
};

export const ARMOR_AC_MAPPING: any = {
    "mappings": [
        { "minAC": 10, "maxAC": 11, "item": null, "description": "No armor / Natural" },
        { "minAC": 12, "maxAC": 12, "item": "Padded", "description": "Padded armor" },
        { "minAC": 13, "maxAC": 14, "item": "Leather", "description": "Leather / Studded Leather" },
        { "minAC": 15, "maxAC": 16, "item": "Chain_Shirt", "description": "Chain Shirt / Scale Mail" },
        { "minAC": 17, "maxAC": 17, "item": "Splint", "description": "Splint / Half Plate" },
        { "minAC": 18, "maxAC": 30, "item": "Plate", "description": "Plate armor" }
    ],
    "droppableTypes": ["humanoid", "giant"]
};

export const LOOT_TIERS: any = {
    "tiers": [
        { "id": 0, "minCR": 0, "maxCR": 0.25, "goldDice": "1d6", "goldDenom": "cp", "itemChance": 0.05, "maxItemValue": 10 },
        { "id": 1, "minCR": 0.5, "maxCR": 1, "goldDice": "2d6", "goldDenom": "sp", "itemChance": 0.15, "maxItemValue": 50 },
        { "id": 2, "minCR": 2, "maxCR": 4, "goldDice": "3d6", "goldDenom": "gp", "itemChance": 0.25, "maxItemValue": 500 },
        { "id": 3, "minCR": 5, "maxCR": 10, "goldDice": "4d6", "goldMultiplier": 10, "goldDenom": "gp", "itemChance": 0.40, "maxItemValue": 5000 },
        { "id": 4, "minCR": 11, "maxCR": 16, "goldDice": "5d6", "goldMultiplier": 100, "goldDenom": "gp", "itemChance": 0.60, "maxItemValue": 50000 },
        { "id": 5, "minCR": 17, "maxCR": 40, "goldDice": "6d6", "goldMultiplier": 1000, "goldDenom": "gp", "itemChance": 0.80, "maxItemValue": 500000 }
    ]
};
