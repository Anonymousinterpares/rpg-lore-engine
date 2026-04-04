if (typeof localStorage === 'undefined') { const s: Record<string,string>={}; (global as any).localStorage={getItem:(k:string)=>s[k]||null,setItem:(k:string,v:string)=>{s[k]=v},removeItem:()=>{},clear:()=>{}}; }
import { NPCFactory } from '../factories/NPCFactory';
import { CompanionManager } from '../combat/CompanionManager';
import { LevelingEngine } from '../combat/LevelingEngine';
import { MechanicsEngine } from '../combat/MechanicsEngine';

const state = {
    character: { name: 'Aldric', level: 5, xp: 6500, race: 'Human', class: 'Fighter',
        hp: { current: 40, max: 40, temp: 0 }, ac: 16,
        stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 13, CHA: 11 },
        inventory: { gold: { cp:0,sp:0,ep:0,gp:500,pp:0 }, items: [] },
        spellSlots: {}, conditions: [], equipmentSlots: {}, attunedItems: [],
        cantripsKnown:[], preparedSpells:[], knownSpells:[], spellbook:[],
        hitDice: { current: 5, max: 5, dieType: '1d10' },
        deathSaves: { successes: 0, failures: 0 },
        savingThrowProficiencies: ['STR','CON'], skillProficiencies: [],
        feats: [], weaponProficiencies: [],
        skills: {}, skillPoints: { available: 0, totalEarned: 0 },
    },
    companions: [] as any[], worldNpcs: [] as any[], mode: 'EXPLORATION',
    worldMap: { hexes: { '0,0': { npcs: [] as string[], interest_points: [], resourceNodes: [], biome: 'Plains', coordinates: [0,0] } } },
    location: { hexId: '0,0', coordinates: [0,0] },
    worldTime: { hour: 14, day: 5, month: 6, year: 1489, totalTurns: 20 },
    factions: [], activeQuests: [], conversationHistory: [], storySummary: '', lastNarrative: '',
} as any;

// Add companion
const npc = NPCFactory.createNPC('Grimjaw', false, undefined, 'Guard');
npc.relationship.standing = 75;
state.worldNpcs.push(npc);
state.worldMap.hexes['0,0'].npcs = [npc.id];
CompanionManager.recruit(state, npc.id);

console.log('Player level:', state.character.level, 'XP:', state.character.xp);
console.log('Companion level:', state.companions[0].character.level);
console.log('Companion class:', state.companions[0].character.class);
console.log('Can player level up?', LevelingEngine.canLevelUp(state.character));

const threshold = MechanicsEngine.getNextLevelXP(5);
console.log('XP needed for level 6:', threshold);
state.character.xp = threshold;
console.log('Can level up now?', LevelingEngine.canLevelUp(state.character));

const msg = LevelingEngine.levelUp(state.character);
console.log('Player leveled:', msg);
console.log('Player new level:', state.character.level);

const targetCompLevel = Math.max(1, state.character.level - 1);
console.log('Target comp level:', targetCompLevel);
const comp = state.companions[0];
console.log('Comp level before:', comp.character.level);
console.log('Needs leveling:', comp.character.level < targetCompLevel);

if (comp.character.level < targetCompLevel) {
    const oldLevel = comp.character.level;
    comp.character.xp = MechanicsEngine.getNextLevelXP(comp.character.level);
    console.log('Comp XP set to:', comp.character.xp, '(threshold for level', comp.character.level + 1, ')');
    console.log('Can comp level up?', LevelingEngine.canLevelUp(comp.character));
    const compMsg = LevelingEngine.levelUp(comp.character);
    console.log('Comp leveled:', compMsg);
    console.log('Comp new level:', comp.character.level);

    comp.meta.pendingLevelUp = {
        oldLevel, newLevel: comp.character.level,
        oldMaxHp: 20, newMaxHp: comp.character.hp.max,
        oldAc: 16, newAc: comp.character.ac,
        oldSpellSlots: {}, newSpellSlots: {},
    };
    console.log('pendingLevelUp set:', JSON.stringify(comp.meta.pendingLevelUp));
} else {
    console.log('NO LEVELING NEEDED - comp already at target or above');
}

// Check item data
console.log('\n--- Item database check ---');
const { DataManager } = require('../data/DataManager');
const leather = DataManager.getItem('leather');
console.log('leather:', leather ? `${leather.name} (${leather.type}, ${leather.weight}lb)` : 'NOT FOUND');
const chainMail = DataManager.getItem('chain_mail');
console.log('chain_mail:', chainMail ? `${chainMail.name} (${chainMail.type}, ${chainMail.weight}lb)` : 'NOT FOUND');
const roundShield = DataManager.getItem('round_shield');
console.log('round_shield:', roundShield ? `${roundShield.name} (${roundShield.type}, ${roundShield.weight}lb)` : 'NOT FOUND');
const arrow = DataManager.getItem('arrow');
console.log('arrow:', arrow ? `${arrow.name} (${arrow.type}, ${arrow.weight}lb)` : 'NOT FOUND');

console.log('\n--- Companion inventory ---');
for (const item of comp.character.inventory.items) {
    console.log(`  ${(item as any).name} (${(item as any).type}, ${(item as any).weight}lb, equipped: ${(item as any).equipped})`);
}
