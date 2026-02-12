import { Faction } from '../schemas/FactionSchema';

export const FACTION_LORE = {
    HARPERS: {
        id: 'harpers',
        name: 'The Harpers',
        description: 'A secretive organization dedicated to preserving historical lore and maintaining a balance between the powers of the world.',
        motto: 'Down with Tyranny. Up with the People.',
        goals: 'Gather information, eliminate threats to the balance, support the oppressed.',
        alignment: 'Chaotic Good'
    },
    ORDER_GAUNTLET: {
        id: 'order_gauntlet',
        name: 'The Order of the Gauntlet',
        description: 'A brotherhood of holy warriors and clergy who stand ready to smite evil wherever it rears its head.',
        motto: 'Stand Tall. Strike True. Fear No Evil.',
        goals: 'Vengeance against the wicked, protection of the innocent, spreading the light of the divine.',
        alignment: 'Lawful Good'
    },
    EMERALD_ENCLAVE: {
        id: 'emerald_enclave',
        name: 'The Emerald Enclave',
        description: 'A wide-ranging group that opposes threats to the natural world and seeks to keep the wilderness and civilization in balance.',
        motto: 'Nature\'s Balance Must Be Maintained.',
        goals: 'Protection of the wild, restoration of blasted lands, destruction of unnatural abominations.',
        alignment: 'Neutral'
    },
    LORDS_ALLIANCE: {
        id: 'lords_alliance',
        name: 'The Lords\' Alliance',
        description: 'A political coalition of cities and towns that seeks to bring security and trade to the realms.',
        motto: 'Safety through Unity. Prosperity through Law.',
        goals: 'Establishing common laws, protecting trade routes, eliminating banditry and lawlessness.',
        alignment: 'Lawful Neutral'
    },
    ZHENTARIM: {
        id: 'zhentarim',
        name: 'The Zhentarim',
        description: 'Known as the Black Network, this mercenary group seeks to monopolize trade and expand their influence through wealth and power.',
        motto: 'Power to the Persistent. Profit to the Bold.',
        goals: 'Mercenary contracts, control of trade, gathering political leverage.',
        alignment: 'Lawful/Neutral Evil'
    }
};

export const INITIAL_FACTIONS: Faction[] = Object.values(FACTION_LORE).map(f => ({
    id: f.id,
    name: f.name,
    description: f.description,
    standing: 0,
    isPlayerMember: false
}));
