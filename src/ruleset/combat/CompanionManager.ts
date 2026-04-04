import { GameState } from '../schemas/FullSaveStateSchema';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import {
    Companion, CompanionMeta, MAX_PARTY_SIZE,
    calculateRecruitmentCost, ROLE_CLASS_MAP
} from '../schemas/CompanionSchema';
import { DataManager } from '../data/DataManager';
import { EquipmentEngine } from './EquipmentEngine';
import { buildSpellSlotsFromProgression } from './LevelingEngine';
import { Dice } from './Dice';
import { v4 as uuidv4 } from 'uuid';

/**
 * Role-based starter equipment sets.
 * Each entry: { mainHand?, offHand?, armor?, items?[] }
 * Uses item IDs from the game data catalog.
 */
// Item IDs use underscore format matching DataManager index: name.toLowerCase().replace(/ /g, '_')
const STARTER_EQUIPMENT: Record<string, { mainHand?: string; offHand?: string; armor?: string; items?: string[] }> = {
    'Guard':      { mainHand: 'longsword', offHand: 'shield', armor: 'chain_mail' },
    'Mercenary':  { mainHand: 'longsword', armor: 'chain_shirt', items: ['handaxe'] },
    'Fighter':    { mainHand: 'longsword', offHand: 'shield', armor: 'chain_mail' },
    'Bandit':     { mainHand: 'shortsword', armor: 'leather_armor', items: ['shortbow', 'arrows_(20)'] },
    'Scout':      { mainHand: 'shortsword', armor: 'leather_armor', items: ['shortbow', 'arrows_(20)'] },
    'Hunter':     { mainHand: 'shortbow', armor: 'leather_armor', items: ['shortsword', 'arrows_(20)'] },
    'Scholar':    { mainHand: 'quarterstaff', items: ['component_pouch'] },
    'Druid':      { mainHand: 'quarterstaff', armor: 'leather_armor', items: ['herbalism_kit'] },
    'Hermit':     { mainHand: 'mace', armor: 'leather_armor', items: ['shield'] },
    'Monk':       { mainHand: 'quarterstaff' },
    'Merchant':   { mainHand: 'dagger', items: ['crossbow,_light', 'bolts_(20)'] },
    'Noble':      { mainHand: 'rapier', armor: 'leather_armor' },
    'Farmer':     { mainHand: 'handaxe', items: ['sickle'] },
    'Miner':      { mainHand: 'light_hammer', items: ['handaxe'] },
    'Cultist':    { mainHand: 'dagger', items: ['component_pouch'] },
    'Beggar':     { mainHand: 'club' },
    'Traveler':   { mainHand: 'shortsword', armor: 'leather_armor' },
    'Explorer':   { mainHand: 'shortsword', armor: 'leather_armor', items: ['shortbow', 'arrows_(20)'] },
    'Sailor':     { mainHand: 'scimitar', armor: 'leather_armor' },
    'Fisherman':  { mainHand: 'spear' },
};

export interface RecruitResult {
    success: boolean;
    message: string;
    goldCost?: number;
}

export class CompanionManager {

    /**
     * Attempts to recruit an NPC into the party.
     * Enforces mechanistic gates: standing threshold, party size, gold.
     */
    public static recruit(
        state: GameState,
        npcId: string,
        hasFactionDiscount: boolean = false
    ): RecruitResult {
        const npc = state.worldNpcs.find(n => n.id === npcId);
        if (!npc) return { success: false, message: `NPC not found.` };

        // Party size check
        if (state.companions.length >= MAX_PARTY_SIZE) {
            return { success: false, message: `Your party is full (max ${MAX_PARTY_SIZE} companions). Dismiss someone first.` };
        }

        // Already in party check
        if (state.companions.some(c => c.meta.sourceNpcId === npcId)) {
            return { success: false, message: `${npc.name} is already in your party.` };
        }

        // Standing threshold
        const STANDING_THRESHOLD = 10;
        if (npc.relationship.standing < STANDING_THRESHOLD) {
            return {
                success: false,
                message: `${npc.name} doesn't trust you enough to join (standing: ${npc.relationship.standing}, need ${STANDING_THRESHOLD}+).`
            };
        }

        // Calculate gold cost
        const npcLevel = Math.max(1, state.character.level - 1);
        const goldCost = calculateRecruitmentCost(
            npc.role, npc.relationship.standing, npcLevel, hasFactionDiscount
        );

        // Gold check
        const playerGold = state.character.inventory.gold?.gp || 0;
        if (playerGold < goldCost) {
            return {
                success: false,
                message: `${npc.name} requires ${goldCost} gp to join, but you only have ${playerGold} gp.`,
                goldCost
            };
        }

        // Deduct gold
        if (goldCost > 0) {
            state.character.inventory.gold.gp -= goldCost;
        }

        // Convert NPC to companion
        const companion = this.convertNpcToCompanion(npc, state, goldCost);

        // Add to party
        state.companions.push(companion);

        // Remove from world hex (they're traveling with player now)
        this.removeNpcFromWorld(state, npcId);

        return {
            success: true,
            message: `${npc.name} has joined your party${goldCost > 0 ? ` for ${goldCost} gp` : ''}.`,
            goldCost
        };
    }

    /**
     * Dismisses a companion, converting them back to a WorldNPC at a specified hex.
     */
    public static dismiss(
        state: GameState,
        companionIndex: number,
        stayAtCurrentHex: boolean = true
    ): string {
        if (companionIndex < 0 || companionIndex >= state.companions.length) {
            return 'Invalid companion index.';
        }

        const companion = state.companions[companionIndex];
        const name = companion.character.name;

        // Restore as WorldNPC
        const restoredNpc = this.convertCompanionToNpc(companion, state, stayAtCurrentHex);
        state.worldNpcs.push(restoredNpc);

        // Add to current hex's NPC list
        const hexId = stayAtCurrentHex ? state.location.hexId : (companion.meta.waitHexId || state.location.hexId);
        const hex = state.worldMap.hexes[hexId];
        if (hex) {
            if (!hex.npcs) hex.npcs = [];
            hex.npcs.push(restoredNpc.id);
        }

        // Remove from party
        state.companions.splice(companionIndex, 1);

        return `${name} has left the party.`;
    }

    /**
     * Sets a companion to wait at the current hex.
     */
    public static setWait(state: GameState, companionIndex: number): string {
        if (companionIndex < 0 || companionIndex >= state.companions.length) {
            return 'Invalid companion index.';
        }
        const comp = state.companions[companionIndex];
        comp.meta.followState = 'waiting';
        comp.meta.waitHexId = state.location.hexId;
        return `${comp.character.name} will wait here.`;
    }

    /**
     * Resumes following for a waiting companion.
     */
    public static setFollow(state: GameState, companionIndex: number): string {
        if (companionIndex < 0 || companionIndex >= state.companions.length) {
            return 'Invalid companion index.';
        }
        const comp = state.companions[companionIndex];
        if (comp.meta.followState === 'following') {
            return `${comp.character.name} is already following you.`;
        }
        // Must be at the same hex to resume following
        if (comp.meta.waitHexId && comp.meta.waitHexId !== state.location.hexId) {
            return `${comp.character.name} is waiting at another location. Travel there to have them rejoin.`;
        }
        comp.meta.followState = 'following';
        comp.meta.waitHexId = undefined;
        return `${comp.character.name} resumes following you.`;
    }

    /**
     * Finds a companion by name (case-insensitive partial match).
     * Returns the index or -1.
     */
    public static findCompanionIndex(state: GameState, nameQuery: string): number {
        const lower = nameQuery.toLowerCase();
        return state.companions.findIndex(c =>
            c.character.name.toLowerCase().includes(lower)
        );
    }

    /**
     * Converts a WorldNPC into a Companion (PlayerCharacter + meta).
     */
    private static convertNpcToCompanion(npc: WorldNPC, state: GameState, goldCost: number): Companion {
        const npcLevel = Math.max(1, state.character.level - 1);
        const className = ROLE_CLASS_MAP[npc.role || ''] || 'Fighter';
        const classData = DataManager.getClass(className);

        // Calculate HP from class hit die + CON
        const conMod = Math.floor(((npc.stats?.CON || 10) - 10) / 2);
        const hitDieMax = classData?.hitDie ? parseInt(classData.hitDie.replace('1d', '')) : 8;
        const hp = hitDieMax + conMod + ((npcLevel - 1) * (Math.floor(hitDieMax / 2) + 1 + conMod));

        // Calculate AC (base 10 + DEX mod, or 11-15 for martial roles)
        const dexMod = Math.floor(((npc.stats?.DEX || 10) - 10) / 2);
        const martialRoles = ['Guard', 'Mercenary', 'Fighter', 'Bandit', 'Scout', 'Hunter'];
        const baseAc = (npc.role && martialRoles.includes(npc.role)) ? 14 + dexMod : 10 + dexMod;

        const character: PlayerCharacter = {
            name: npc.name,
            sex: (Math.random() < 0.5 ? 'male' : 'female') as any,
            level: npcLevel,
            race: 'Human',
            darkvision: 0,
            class: className,
            subclass: '',
            fightingStyle: '',
            secondaryClass: '',
            multiclassLevels: {},
            conditions: [],
            statusEffects: [],
            stats: npc.stats as any,
            savingThrowProficiencies: classData?.savingThrowProficiencies || ['STR', 'CON'],
            skillProficiencies: [],
            skills: {} as any,
            skillPoints: { available: 0, totalEarned: 0 },
            feats: [],
            weaponProficiencies: [],
            hp: { current: hp, max: hp, temp: 0 },
            deathSaves: { successes: 0, failures: 0 },
            hitDice: { current: npcLevel, max: npcLevel, dieType: classData?.hitDie || '1d8' },
            spellSlots: classData ? buildSpellSlotsFromProgression(classData, npcLevel) : {},
            cantripsKnown: this.pickCantrips(className, npcLevel),
            knownSpells: this.pickSpells(className, npcLevel),
            preparedSpells: this.pickSpells(className, npcLevel),
            spellbook: [],
            unseenSpells: [],
            ac: baseAc,
            featureUsages: {},
            inventory: {
                gold: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
                items: []
            },
            equipmentSlots: {},
            attunedItems: [],
            xp: 0,
            inspiration: false,
            biography: {
                background: npc.role || 'Commoner',
                traits: npc.traits || [],
                ideals: [],
                bonds: [],
                flaws: [],
                chronicles: [{
                    turn: state.worldTime.totalTurns,
                    event: `Joined ${state.character.name}'s party`
                }]
            },
            knownEntities: { monsters: [], items: [] }
        } as any;

        // Assign starter equipment based on role, then recalculate AC using the same system as player
        this.assignStarterEquipment(character, npc.role);
        EquipmentEngine.recalculateAC(character);

        const meta: CompanionMeta = {
            sourceNpcId: npc.id,
            followState: 'following',
            recruitedAtTurn: state.worldTime.totalTurns,
            recruitmentCost: goldCost,
            originalRole: npc.role,
            originalTraits: [...(npc.traits || [])],
            originalFactionId: npc.factionId,
            conversationHistory: [...(npc.conversationHistory || [])], // Carry over pre-recruitment dialogue
            companionStanding: Math.max(10, npc.relationship.standing), // Carry over standing, minimum 10 (recruited = trusts you)
        };

        return { character, meta };
    }

    /**
     * Converts a Companion back to a WorldNPC for dismissal.
     */
    private static convertCompanionToNpc(companion: Companion, state: GameState, atCurrentHex: boolean): WorldNPC {
        const char = companion.character;
        const meta = companion.meta;

        return {
            id: meta.sourceNpcId || uuidv4(),
            name: char.name,
            traits: meta.originalTraits.length > 0 ? meta.originalTraits : char.biography?.traits || [],
            isMerchant: false,
            relationship: {
                standing: 25, // Dismissal retains friendly standing
                interactionLog: [{
                    event: `Left ${state.character.name}'s party`,
                    delta: 0,
                    timestamp: new Date().toISOString()
                }],
                lastInteraction: new Date().toISOString()
            },
            dialogue_triggers: [],
            inventory: [],
            availableQuests: [],
            conversationHistory: [],
            factionId: meta.originalFactionId,
            role: meta.originalRole,
            stats: char.stats as any
        };
    }

    /**
     * Removes an NPC from worldNpcs and all hex.npcs references.
     */
    private static removeNpcFromWorld(state: GameState, npcId: string): void {
        state.worldNpcs = state.worldNpcs.filter(n => n.id !== npcId);
        for (const hexId of Object.keys(state.worldMap.hexes)) {
            const hex = state.worldMap.hexes[hexId];
            if (hex.npcs) hex.npcs = hex.npcs.filter(id => id !== npcId);
        }
    }

    /**
     * Assigns starter equipment to a companion based on role.
     * Uses the same inventory/equipment system as the player.
     * Items get instanceIds and are equipped via equipmentSlots.
     */
    private static assignStarterEquipment(char: PlayerCharacter, role: string | undefined): void {
        const loadout = STARTER_EQUIPMENT[role || ''] || STARTER_EQUIPMENT['Traveler'] || {};

        const addItem = (itemKey: string, equipSlot?: string): void => {
            const data = DataManager.getItem(itemKey);
            const instanceId = uuidv4();
            char.inventory.items.push({
                id: data?.name || itemKey,
                name: data?.name || itemKey,
                type: data?.type || 'Weapon',
                weight: data?.weight || 1,
                instanceId,
                quantity: 1,
                equipped: !!equipSlot,
            } as any);
            if (equipSlot) {
                (char.equipmentSlots as any)[equipSlot] = instanceId;
            }
        };

        if (loadout.mainHand) addItem(loadout.mainHand, 'mainHand');
        if (loadout.offHand)  addItem(loadout.offHand, 'offHand');
        if (loadout.armor)    addItem(loadout.armor, 'armor');
        if (loadout.items) {
            for (const itemKey of loadout.items) addItem(itemKey);
        }
    }

    /**
     * Picks cantrips for a caster class companion.
     */
    private static pickCantrips(className: string, level: number): string[] {
        const CASTER_CANTRIPS: Record<string, string[]> = {
            'Wizard':  ['Fire Bolt', 'Mage Hand', 'Prestidigitation'],
            'Cleric':  ['Sacred Flame', 'Guidance', 'Spare the Dying'],
            'Druid':   ['Produce Flame', 'Shillelagh', 'Guidance'],
            'Warlock': ['Eldritch Blast', 'Minor Illusion'],
            'Bard':    ['Vicious Mockery', 'Minor Illusion'],
            'Ranger':  [],
        };
        const cantrips = CASTER_CANTRIPS[className] || [];
        const count = Math.min(cantrips.length, level >= 4 ? 3 : 2);
        return cantrips.slice(0, count);
    }

    /**
     * Picks known/prepared spells for a caster class companion.
     */
    private static pickSpells(className: string, level: number): string[] {
        const CASTER_SPELLS: Record<string, { 1: string[]; 2: string[] }> = {
            'Wizard':  { 1: ['Magic Missile', 'Shield', 'Mage Armor'], 2: ['Scorching Ray', 'Misty Step'] },
            'Cleric':  { 1: ['Cure Wounds', 'Bless', 'Guiding Bolt'], 2: ['Spiritual Weapon', 'Hold Person'] },
            'Druid':   { 1: ['Cure Wounds', 'Entangle', 'Thunderwave'], 2: ['Moonbeam', 'Barkskin'] },
            'Warlock': { 1: ['Hex', 'Eldritch Blast'], 2: ['Hold Person', 'Misty Step'] },
            'Bard':    { 1: ['Cure Wounds', 'Healing Word', 'Thunderwave'], 2: ['Hold Person', 'Shatter'] },
            'Ranger':  { 1: ['Cure Wounds', "Hunter's Mark"], 2: ['Pass Without Trace'] },
        };
        const spells = CASTER_SPELLS[className];
        if (!spells) return [];

        const picked = [...spells[1]];
        if (level >= 3 && spells[2]) picked.push(...spells[2]);
        return picked;
    }
}
