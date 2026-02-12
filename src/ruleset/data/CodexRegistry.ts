import { FACTION_LORE } from './FactionRegistry';

export const CODEX_LORE = {
    WORLD: {
        [FACTION_LORE.HARPERS.id]: {
            name: FACTION_LORE.HARPERS.name,
            content: `### The Harpers\n${FACTION_LORE.HARPERS.description}\n\n**Motto:** ${FACTION_LORE.HARPERS.motto}\n**Goals:** ${FACTION_LORE.HARPERS.goals}\n**Alignment:** ${FACTION_LORE.HARPERS.alignment}\n\nThe Harpers are a decentralized organization who act in secret. They believe that too much power in the hands of one individual or group leads to corruption. They often work through bards, spies, and scholars to influence events from the shadows.`
        },
        [FACTION_LORE.ORDER_GAUNTLET.id]: {
            name: FACTION_LORE.ORDER_GAUNTLET.name,
            content: `### The Order of the Gauntlet\n${FACTION_LORE.ORDER_GAUNTLET.description}\n\n**Motto:** ${FACTION_LORE.ORDER_GAUNTLET.motto}\n**Goals:** ${FACTION_LORE.ORDER_GAUNTLET.goals}\n**Alignment:** ${FACTION_LORE.ORDER_GAUNTLET.alignment}\n\nMembers of the Order are tireless vigilantes who prioritize justice and the rule of law. They are often found on the front lines against demonic incursions or undead plagues, bonded by their faith and shared sense of duty.`
        },
        [FACTION_LORE.EMERALD_ENCLAVE.id]: {
            name: FACTION_LORE.EMERALD_ENCLAVE.name,
            content: `### The Emerald Enclave\n${FACTION_LORE.EMERALD_ENCLAVE.description}\n\n**Motto:** ${FACTION_LORE.EMERALD_ENCLAVE.motto}\n**Goals:** ${FACTION_LORE.EMERALD_ENCLAVE.goals}\n**Alignment:** ${FACTION_LORE.EMERALD_ENCLAVE.alignment}\n\nDruids, scouts, and rangers make up the bulk of this enclave. They dwell in the spaces between civilization and the wild, ensuring that neither encroaches too far upon the other. They are the first to strike out against unnatural blights and monsters.`
        },
        [FACTION_LORE.LORDS_ALLIANCE.id]: {
            name: FACTION_LORE.LORDS_ALLIANCE.name,
            content: `### The Lords' Alliance\n${FACTION_LORE.LORDS_ALLIANCE.description}\n\n**Motto:** ${FACTION_LORE.LORDS_ALLIANCE.motto}\n**Goals:** ${FACTION_LORE.LORDS_ALLIANCE.goals}\n**Alignment:** ${FACTION_LORE.LORDS_ALLIANCE.alignment}\n\nThis coalition of rulers provides common defense and economic stability. Their guards patrol the high roads, and their diplomats forge alliances that keep the realms running. While bureaucratic, they are the strongest bulwark of order in a chaotic world.`
        },
        [FACTION_LORE.ZHENTARIM.id]: {
            name: FACTION_LORE.ZHENTARIM.name,
            content: `### The Zhentarim\n${FACTION_LORE.ZHENTARIM.description}\n\n**Motto:** ${FACTION_LORE.ZHENTARIM.motto}\n**Goals:** ${FACTION_LORE.ZHENTARIM.goals}\n**Alignment:** ${FACTION_LORE.ZHENTARIM.alignment}\n\nThe "Black Network" is often feared for its ruthlessness, but they are also reliable providers of mercenary labor and high-value goods. They value loyalty and profit above all, and their influence can be felt from the highest courts to the deepest dungeons.`
        }
    }
};
