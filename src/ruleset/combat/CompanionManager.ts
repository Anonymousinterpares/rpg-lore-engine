import { GameState } from '../schemas/FullSaveStateSchema';
import { WorldNPC } from '../schemas/WorldEnrichmentSchema';
import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import {
    Companion, CompanionMeta, MAX_PARTY_SIZE,
    calculateRecruitmentCost, ROLE_CLASS_MAP
} from '../schemas/CompanionSchema';
import { DataManager } from '../data/DataManager';
import { v4 as uuidv4 } from 'uuid';

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
            sex: 'Unknown' as any,
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
            spellSlots: {},
            cantripsKnown: [],
            knownSpells: [],
            preparedSpells: [],
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

        const meta: CompanionMeta = {
            sourceNpcId: npc.id,
            followState: 'following',
            recruitedAtTurn: state.worldTime.totalTurns,
            recruitmentCost: goldCost,
            originalRole: npc.role,
            originalTraits: [...(npc.traits || [])],
            originalFactionId: npc.factionId,
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
        // Remove from worldNpcs array
        state.worldNpcs = state.worldNpcs.filter(n => n.id !== npcId);

        // Remove from any hex's npcs list
        for (const hexId of Object.keys(state.worldMap.hexes)) {
            const hex = state.worldMap.hexes[hexId];
            if (hex.npcs) {
                hex.npcs = hex.npcs.filter(id => id !== npcId);
            }
        }
    }
}
