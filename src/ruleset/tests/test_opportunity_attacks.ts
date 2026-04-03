import { OAEngine } from '../combat/OAEngine';
import { CombatGridManager } from '../combat/grid/CombatGridManager';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0, failed = 0;
function assert(name: string, condition: boolean, detail: string = '') {
    if (condition) { console.log(`  ✅ ${name}${detail ? ': ' + detail : ''}`); passed++; }
    else { console.log(`  ❌ FAIL ${name}${detail ? ': ' + detail : ''}`); failed++; }
}

function makeGrid(): CombatGridManager {
    // Simple 20x20 open grid, no obstacles
    const cells: any = {};
    for (let x = -10; x <= 10; x++) {
        for (let y = -10; y <= 10; y++) {
            cells[`${x},${y}`] = { terrain: 'open', passable: true, features: [] };
        }
    }
    return new CombatGridManager({ cells, width: 20, height: 20 });
}

function makeCombatant(id: string, type: string, pos: {x:number,y:number}, o: any = {}) {
    return {
        id, name: id, type, isPlayer: type === 'player',
        hp: { current: 30, max: 30, temp: 0 }, ac: 14,
        stats: { STR: 14, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 10 },
        statusEffects: [], conditions: [],
        position: { ...pos },
        tactical: { cover: 'None', reach: 5, isRanged: false },
        resources: { actionSpent: false, bonusActionSpent: false, reactionSpent: false },
        movementRemaining: 6, movementSpeed: 6, size: 'Medium', darkvision: 0,
        preparedSpells: [], spellSlots: {},
        ...o
    } as any;
}

async function main() {
    const grid = makeGrid();

    // ═══ BASIC OA: LEAVING ENEMY REACH ═══
    console.log('\n=== BASIC OA: LEAVING ENEMY REACH ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const goblin = makeCombatant('goblin', 'enemy', {x:1,y:0});
        const combatants = [player, goblin];

        // Path: move from (0,0) to (0,2) — player leaves goblin's reach at step 1 (0,0→0,1)
        const path = [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}];
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);

        assert('OA triggered', results.length === 1, `${results.length} OAs`);
        assert('Goblin attacked', results[0]?.attackerName === 'goblin');
        assert('Player was target', results[0]?.targetName === 'player');
        assert('Goblin reaction spent', goblin.resources.reactionSpent === true);
    }

    // ═══ NO OA: STAYING IN REACH ═══
    console.log('\n=== NO OA: STAYING IN REACH ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const goblin = makeCombatant('goblin', 'enemy', {x:2,y:0});
        const combatants = [player, goblin];

        // Move parallel, staying in reach (distance 1 at all steps)
        const path = [{x:0,y:0}, {x:1,y:0}]; // Moving toward goblin
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
        assert('No OA when moving toward', results.length === 0, `${results.length}`);
    }

    // ═══ DISENGAGE PREVENTS OA ═══
    console.log('\n=== DISENGAGE PREVENTS OA ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0}, {
            statusEffects: [{id:'disengage',name:'Disengage',type:'BUFF',duration:1}]
        });
        const goblin = makeCombatant('goblin', 'enemy', {x:1,y:0});
        const combatants = [player, goblin];

        const path = [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}];
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
        assert('Disengage prevents OA', results.length === 0, `${results.length}`);
        assert('Goblin reaction NOT spent', goblin.resources.reactionSpent === false);
    }

    // ═══ REACTION ALREADY SPENT ═══
    console.log('\n=== REACTION ALREADY SPENT ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const goblin = makeCombatant('goblin', 'enemy', {x:1,y:0}, {
            resources: { actionSpent: false, bonusActionSpent: false, reactionSpent: true }
        });
        const combatants = [player, goblin];

        const path = [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}];
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
        assert('No OA when reaction spent', results.length === 0);
    }

    // ═══ MULTIPLE ENEMIES ═══
    console.log('\n=== MULTIPLE ENEMIES OA ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const g1 = makeCombatant('goblin1', 'enemy', {x:1,y:0});
        const g2 = makeCombatant('goblin2', 'enemy', {x:0,y:1});
        const combatants = [player, g1, g2];

        // Move from (0,0) to (0,-2) — leaves both goblins' reach
        const path = [{x:0,y:0}, {x:0,y:-1}, {x:0,y:-2}];
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
        assert('Both enemies get OA', results.length === 2, `${results.length}`);
        assert('Both spent reaction', g1.resources.reactionSpent && g2.resources.reactionSpent);
    }

    // ═══ DEAD ENEMY CAN'T OA ═══
    console.log('\n=== DEAD ENEMY NO OA ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const dead = makeCombatant('dead_goblin', 'enemy', {x:1,y:0}, {
            hp: { current: 0, max: 7, temp: 0 }
        });
        const combatants = [player, dead];

        const path = [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}];
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
        assert('Dead enemy no OA', results.length === 0);
    }

    // ═══ SENTINEL FEAT: STOPS MOVEMENT ═══
    console.log('\n=== SENTINEL: STOPS MOVEMENT ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const sentinel = makeCombatant('sentinel_guard', 'enemy', {x:1,y:0}, {
            feats: ['Sentinel'] // Feat on the enemy combatant itself
        });
        const combatants = [player, sentinel];

        // Path: (0,0) → (0,1) → (0,2)
        const path = [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}];
        const { results, stopAtIndex } = OAEngine.resolveOAsOnPath(
            player, path, combatants, grid
        );

        // Sentinel: OA resolves. If it hits, movement stops.
        assert('OA triggered', results.length >= 1);
        if (results[0]?.hit) {
            assert('Sentinel stops movement on hit', results[0].sentinelStopsMovement === true);
            assert('Sentinel stops at OA step', stopAtIndex <= path.length - 1, `stopped at ${stopAtIndex}`);
            assert('Movement remaining = 0', player.movementRemaining === 0);
        } else {
            assert('Sentinel miss: movement continues', stopAtIndex === path.length - 1);
        }
    }

    // ═══ SENTINEL IGNORES DISENGAGE ═══
    console.log('\n=== SENTINEL IGNORES DISENGAGE ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0}, {
            statusEffects: [{id:'disengage',name:'Disengage',type:'BUFF',duration:1}]
        });
        const sentinel = makeCombatant('sentinel_guard', 'enemy', {x:1,y:0}, {
            feats: ['Sentinel']
        });
        const combatants = [player, sentinel];

        const path = [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}];
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
        assert('Sentinel ignores Disengage', results.length === 1, `${results.length} OAs`);
    }

    // ═══ POLEARM MASTER: ENTERING REACH ═══
    console.log('\n=== POLEARM MASTER: ENTERING REACH ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const polearm = makeCombatant('polearm_knight', 'enemy', {x:3,y:0}, {
            tactical: { cover: 'None', reach: 10, isRanged: false }, // 10ft = 2 cells
            feats: ['Polearm Master']
        });
        const combatants = [player, polearm];

        // Move from (0,0) toward (3,0) — enters 10ft reach at step 1 (x=1, dist=2 ≤ 2 cells)
        const path = [{x:0,y:0}, {x:1,y:0}, {x:2,y:0}];
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
        assert('Polearm Master OA on enter reach', results.length >= 1, `${results.length}`);
        if (results.length > 0) {
            assert('Message mentions entering reach', results[0].message.includes('enters reach'));
        }
    }

    // ═══ REACH WEAPON: 10FT REACH OA ═══
    console.log('\n=== 10FT REACH OA ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const reachEnemy = makeCombatant('ogre', 'enemy', {x:2,y:0}, {
            tactical: { cover: 'None', reach: 10, isRanged: false }
        });
        const combatants = [player, reachEnemy];

        // Player at (0,0) is within 10ft (2 cells) of ogre at (2,0)
        // Moving to (0,-1) takes player out of 10ft reach
        const path = [{x:0,y:0}, {x:-1,y:0}, {x:-2,y:0}];
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
        assert('10ft reach OA triggers', results.length === 1, `${results.length}`);
    }

    // ═══ OA WARNINGS ═══
    console.log('\n=== OA WARNINGS (for easy/normal difficulty) ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const goblin = makeCombatant('goblin', 'enemy', {x:1,y:0});
        const combatants = [player, goblin];

        const path = [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}];
        const warnings = OAEngine.getOAWarnings(player, path, combatants, grid);
        assert('Warning generated', warnings.length === 1, `${warnings.length}`);
        assert('Warning has goblin name', warnings[0]?.combatantName === 'goblin');

        // No warning with disengage
        const playerDis = makeCombatant('player', 'player', {x:0,y:0}, {
            statusEffects: [{id:'disengage',name:'Disengage',type:'BUFF',duration:1}]
        });
        const warningsDis = OAEngine.getOAWarnings(playerDis, path, [playerDis, goblin], grid);
        assert('No warning with Disengage', warningsDis.length === 0);
    }

    // ═══ ENEMY MOVEMENT OA (AI triggers player OA) ═══
    console.log('\n=== ENEMY MOVEMENT TRIGGERS PLAYER OA ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const goblin = makeCombatant('goblin', 'enemy', {x:1,y:0});
        const combatants = [player, goblin];

        // Goblin moves away from player — player gets OA
        const path = [{x:1,y:0}, {x:2,y:0}, {x:3,y:0}];
        const { results } = OAEngine.resolveOAsOnPath(goblin, path, combatants, grid);
        assert('Player gets OA on enemy retreat', results.length === 1);
        assert('Player attacked', results[0]?.attackerName === 'player');
        assert('Player reaction spent', player.resources.reactionSpent === true);
    }

    // ═══ SAME FACTION: NO OA ═══
    console.log('\n=== SAME FACTION: NO OA ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const companion = makeCombatant('companion', 'companion', {x:1,y:0});
        // companion type is not 'enemy', player type is 'player' — different but allied
        // The OA engine checks c.type !== mover.type, so companion moving won't trigger player OA
        // But companion is 'companion' type, player is 'player' type — they ARE different types
        // We need to ensure allies don't OA each other
        // Actually, the OA engine checks faction: enemies are 'enemy', allies are 'player'/'companion'
        // A companion moving past a player shouldn't trigger OA
        const combatants = [player, companion];
        const path = [{x:1,y:0}, {x:1,y:1}, {x:1,y:2}];
        const { results } = OAEngine.resolveOAsOnPath(companion, path, combatants, grid);
        // This WOULD trigger because player.type ('player') !== companion.type ('companion')
        // This is a BUG — allies should not OA each other
        // Let me check: both are not 'enemy', but different types
        assert('BUG CHECK: allies should NOT OA each other', results.length === 0, `${results.length} (if >0, need faction fix)`);
    }

    // ═══ ONE OA PER ENEMY PER MOVE ═══
    console.log('\n=== ONE OA PER ENEMY PER MOVE ===');
    {
        const player = makeCombatant('player', 'player', {x:0,y:0});
        const goblin = makeCombatant('goblin', 'enemy', {x:1,y:1});
        const combatants = [player, goblin];

        // Zigzag path that leaves and re-enters goblin reach multiple times
        // (0,0)→(0,1)→(1,1)→(0,1)→(0,2) — complex path
        const path = [{x:0,y:0}, {x:-1,y:0}, {x:-1,y:1}, {x:0,y:2}, {x:0,y:3}];
        const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
        assert('Max 1 OA per enemy', results.filter(r => r.attackerName === 'goblin').length <= 1,
            `${results.filter(r => r.attackerName === 'goblin').length}`);
    }

    // ═══ STATISTICAL: OA DAMAGE ═══
    console.log('\n=== STATISTICAL: OA DAMAGE ===');
    {
        let totalDmg = 0, hits = 0, total = 0;
        for (let i = 0; i < 200; i++) {
            const player = makeCombatant('player', 'player', {x:0,y:0}, { hp: { current: 100, max: 100, temp: 0 } });
            const goblin = makeCombatant('goblin', 'enemy', {x:1,y:0}, { stats: { STR: 14, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 } });
            const combatants = [player, goblin];
            const path = [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}];
            const { results } = OAEngine.resolveOAsOnPath(player, path, combatants, grid);
            total++;
            if (results.length > 0 && results[0].hit) {
                hits++;
                totalDmg += results[0].damage;
            }
        }
        const hitRate = hits / total * 100;
        const avgDmg = totalDmg / Math.max(1, hits);
        assert('OA hit rate reasonable (20-80%)', hitRate > 20 && hitRate < 80, `${hitRate.toFixed(1)}%`);
        assert('OA avg damage > 0', avgDmg > 0, `avg=${avgDmg.toFixed(1)}`);
    }

    console.log(`\n=== TOTAL: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
