import { BiomeType } from '../schemas/BiomeSchema';

export interface SpawnConfig {
    chance: number;
    roles: string[];
    dominantFaction?: string;
}

export const SPAWN_TABLES: Record<BiomeType, SpawnConfig> = {
    'Urban': {
        chance: 0.5,
        roles: ['Citizen', 'Guard', 'Merchant', 'Noble', 'Beggar'],
        dominantFaction: 'lords_alliance'
    },
    'Farmland': {
        chance: 0.3,
        roles: ['Farmer', 'Herder', 'Merchant', 'Guard'],
        dominantFaction: 'lords_alliance'
    },
    'Plains': {
        chance: 0.3,
        roles: ['Traveler', 'Scout', 'Merchant', 'Mercenary'],
        dominantFaction: 'lords_alliance'
    },
    'Forest': {
        chance: 0.15,
        roles: ['Hunter', 'Druid', 'Scout', 'Woodcutter'],
        dominantFaction: 'emerald_enclave'
    },
    'Jungle': {
        chance: 0.15,
        roles: ['Hunter', 'Druid', 'Scout', 'Explorer'],
        dominantFaction: 'emerald_enclave'
    },
    'Hills': {
        chance: 0.15,
        roles: ['Miner', 'Goatherd', 'Prospector', 'Bandit'],
        dominantFaction: 'zhentarim'
    },
    'Mountains': {
        chance: 0.15,
        roles: ['Miner', 'Prospector', 'Hermit', 'Bandit'],
        dominantFaction: 'zhentarim'
    },
    'Coast': {
        chance: 0.15,
        roles: ['Fisherman', 'Sailor', 'Castaway', 'Smuggler'],
        dominantFaction: 'lords_alliance'
    },
    'Ocean': {
        chance: 0.01,
        roles: ['Sailor', 'Castaway', 'Smuggler'],
        dominantFaction: 'lords_alliance'
    },
    'Swamp': {
        chance: 0.05,
        roles: ['Hermit', 'Scavenger', 'Witch', 'Bandit'],
        dominantFaction: 'emerald_enclave'
    },
    'Desert': {
        chance: 0.05,
        roles: ['Nomad', 'Explorer', 'Merchant', 'Bandit'],
        dominantFaction: 'zhentarim'
    },
    'Tundra': {
        chance: 0.05,
        roles: ['Hunter', 'Scout', 'Hermit', 'Explorer'],
        dominantFaction: 'emerald_enclave'
    },
    'Volcanic': {
        chance: 0.01,
        roles: ['Archaeologist', 'Explorer', 'Cultist'],
        dominantFaction: 'zhentarim'
    },
    'Ruins': {
        chance: 0.1,
        roles: ['Archaeologist', 'Scavenger', 'Cultist', 'Wanderer'],
        dominantFaction: 'zhentarim'
    }
};
