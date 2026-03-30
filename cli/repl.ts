/**
 * Core Game Loop REPL — Play the RPG through terminal
 *
 * Run: npx tsx cli/repl.ts
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import * as path from 'path';
import { bootstrapCLI } from './bootstrap';
import { GameLoop } from '../src/ruleset/combat/GameLoop';
import { GameStateManager } from '../src/ruleset/combat/GameStateManager';
import { FileStorageProvider } from '../src/ruleset/combat/FileStorageProvider';
import { GameState } from '../src/ruleset/schemas/FullSaveStateSchema';
import { runCreationWizard, createQuickCharacter } from './creation';
import { CLI_CONFIG } from './CLIConfig';

let projectRoot: string;
let gameLoop: GameLoop | null = null;
let stateManager: GameStateManager;
let turnCount = 0;

// --- Compact status line ---
function compactStatus(state: GameState): string {
    const c = state.character;
    const loc = state.location;
    const hex = state.worldMap?.hexes?.[loc.hexId];
    const biome = hex?.biome || '???';
    const time = state.worldTime;
    const h = String(time.hour).padStart(2, '0');
    const m = String(time.minute).padStart(2, '0');
    const weather = state.weather?.type || 'Clear';
    const mode = state.mode;

    return `[${mode}] ${c.name} Lv${c.level} ${c.class} | HP:${c.hp.current}/${c.hp.max} AC:${c.ac} | ${biome} (${loc.coordinates.join(',')}) | ${h}:${m} ${weather}`;
}

// --- Help ---
function showHelp() {
    console.log(`
╔═══════════════════════════════════════════════╗
║              CLI COMMANDS                     ║
╠═══════════════════════════════════════════════╣
║ EXPLORATION                                   ║
║  /look          — Describe current location   ║
║  /move <dir>    — Move (N,S,NE,NW,SE,SW)     ║
║  /rest short    — Short rest (1 hour)         ║
║  /rest long     — Long rest (8 hours)         ║
║  /wait <min>    — Wait N minutes              ║
║  /pace <mode>   — Normal / Fast / Stealth     ║
║  /survey        — Survey surroundings         ║
║  /talk <npc>    — Talk to NPC                 ║
║  /trade <npc>   — Trade with NPC              ║
║                                               ║
║ INVENTORY                                     ║
║  /item_pickup <id> — Pick up item             ║
║  /item_drop <id>   — Drop item                ║
║  /item_equip <id>  — Equip item               ║
║                                               ║
║ COMBAT                                        ║
║  attack / dodge / dash / hide / end turn      ║
║  /cast <spell> [target]                       ║
║  /move <x> <y> [pace]                         ║
║  /combat <enemy> <count> — Start combat (dev) ║
║                                               ║
║ CLI                                           ║
║  /status        — Full character status        ║
║  /save [name]   — Save game                   ║
║  /quit          — Exit game                   ║
║  /help          — Show this help              ║
╚═══════════════════════════════════════════════╝
`);
}

// --- Save ---
async function saveGame(name?: string) {
    if (!gameLoop) return;
    const state = gameLoop.getState();
    const slotName = name || `${state.character.name} — Turn ${state.worldTime.totalTurns}`;
    await stateManager.saveGame(state, slotName);
    console.log(`  Game saved: "${slotName}"`);
}

// --- Main Menu ---
async function mainMenu(rl: readline.Interface): Promise<GameState | null> {
    console.log('\n╔════════════════════════════════════╗');
    console.log('║       RPG LORE ENGINE — CLI        ║');
    console.log('╚════════════════════════════════════╝');
    console.log('  1. New Game (Interactive)');
    console.log('  2. Quick Start (Fighter/Soldier)');
    console.log('  3. Load Game');
    console.log('  4. Quit');

    const choice = await rl.question('\nChoice: ');

    switch (choice.trim()) {
        case '1': {
            const result = await runCreationWizard(rl, projectRoot);
            return result?.state || null;
        }
        case '2': {
            const state = createQuickCharacter({ name: 'Adventurer' });
            console.log(`\n  Quick start: ${state.character.name} the ${state.character.race} ${state.character.class}`);
            return state;
        }
        case '3': {
            const registry = await stateManager.getSaveRegistry();
            if (!registry.slots || registry.slots.length === 0) {
                console.log('  No saves found.');
                return mainMenu(rl);
            }
            console.log('\n--- Saved Games ---');
            registry.slots.forEach((slot: any, i: number) => {
                console.log(`  ${i + 1}. ${slot.slotName || slot.characterName} (Lv${slot.characterLevel} ${slot.characterClass}) — ${slot.lastSaved}`);
            });
            const loadChoice = await rl.question(`\nLoad (1-${registry.slots.length}, or 0 to cancel): `);
            const idx = parseInt(loadChoice) - 1;
            if (idx >= 0 && idx < registry.slots.length) {
                const loaded = await stateManager.loadGame(registry.slots[idx].id);
                if (loaded) {
                    console.log(`  Loaded: ${loaded.character.name}`);
                    return loaded;
                }
                console.log('  Failed to load save.');
            }
            return mainMenu(rl);
        }
        case '4':
            return null;
        default:
            console.log('  Invalid choice.');
            return mainMenu(rl);
    }
}

// --- REPL ---
async function gameREPL(rl: readline.Interface, initialState: GameState) {
    const storage = new FileStorageProvider();
    const savesDir = path.join(projectRoot, 'saves');

    gameLoop = new GameLoop(initialState, savesDir, storage);
    await gameLoop.initialize();

    console.log(`\n  Game initialized. Type /help for commands.\n`);
    console.log(compactStatus(gameLoop.getState()));

    turnCount = 0;

    while (true) {
        const state = gameLoop.getState();
        const modeTag = state.mode === 'COMBAT' ? 'COMBAT' :
                        state.activeDialogueNpcId ? 'DIALOGUE' : 'EXPLORATION';
        const prompt = `\n[${modeTag}] > `;

        let userInput: string;
        try {
            userInput = await rl.question(prompt);
        } catch {
            // readline closed (Ctrl+C / Ctrl+D)
            break;
        }

        const trimmed = userInput.trim();
        if (!trimmed) continue;

        // --- CLI-only commands ---
        if (trimmed === '/quit' || trimmed === '/exit') {
            const confirm = await rl.question('  Save before quitting? (y/n): ');
            if (confirm.toLowerCase() === 'y') await saveGame();
            console.log('  Goodbye!');
            break;
        }

        if (trimmed === '/help') {
            showHelp();
            continue;
        }

        if (trimmed === '/status') {
            const s = gameLoop.getState();
            const c = s.character;
            console.log(`\n  === ${c.name} ===`);
            console.log(`  Level ${c.level} ${c.race} ${c.class} (${c.sex})`);
            console.log(`  HP: ${c.hp.current}/${c.hp.max}  AC: ${c.ac}  XP: ${c.xp || 0}`);
            console.log(`  STR:${c.stats.STR}  DEX:${c.stats.DEX}  CON:${c.stats.CON}  INT:${c.stats.INT}  WIS:${c.stats.WIS}  CHA:${c.stats.CHA}`);
            if (c.conditions.length > 0) console.log(`  Conditions: ${c.conditions.join(', ')}`);
            console.log(`  Skills: ${c.skillProficiencies.join(', ')}`);
            if (c.cantripsKnown.length > 0) console.log(`  Cantrips: ${c.cantripsKnown.join(', ')}`);
            if (c.knownSpells.length > 0) console.log(`  Known Spells: ${c.knownSpells.join(', ')}`);
            if (c.spellbook.length > 0) console.log(`  Spellbook: ${c.spellbook.join(', ')}`);
            console.log(`  Gold: ${c.inventory.gold.gp}gp ${c.inventory.gold.sp}sp ${c.inventory.gold.cp}cp`);
            console.log(`  Items (${c.inventory.items.length}): ${c.inventory.items.map((i: any) => i.name).join(', ')}`);
            continue;
        }

        if (trimmed.startsWith('/save')) {
            const name = trimmed.slice(5).trim() || undefined;
            await saveGame(name);
            continue;
        }

        // --- Engine commands ---
        try {
            const response = await gameLoop.processTurn(trimmed);
            if (response) {
                console.log(`\n${response}`);
            }

            // Show compact status after each turn
            if (CLI_CONFIG.showCompactStatus) {
                console.log(`\n  ${compactStatus(gameLoop.getState())}`);
            }

            // Show last narrative if different from response
            const currentState = gameLoop.getState();
            if (currentState.lastNarrative && currentState.lastNarrative !== response) {
                // Narrator generated additional text
            }

            // Auto-save
            turnCount++;
            if (turnCount % CLI_CONFIG.autoSaveInterval === 0) {
                await saveGame();
            }

        } catch (e) {
            console.error(`  Error: ${(e as Error).message}`);
        }
    }
}

// --- Entry ---
async function main() {
    projectRoot = await bootstrapCLI();

    const savesDir = path.join(projectRoot, 'saves');
    const storage = new FileStorageProvider();
    stateManager = new GameStateManager(savesDir, storage);

    const rl = readline.createInterface({ input, output });

    try {
        const state = await mainMenu(rl);
        if (state) {
            await gameREPL(rl, state);
        }
    } finally {
        rl.close();
    }
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
