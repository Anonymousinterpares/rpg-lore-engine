/**
 * CombatRenderer — Initiative, ASCII grid, tactical options, combat log
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

/**
 * Render initiative order with turn marker.
 */
export function renderInitiative(state: GameState): string {
    const combat = state.combat;
    if (!combat) return '  No active combat.';

    const lines: string[] = ['  === Initiative Order ==='];
    const combatants = combat.combatants || [];

    combatants.forEach((c: any, i: number) => {
        const marker = i === combat.currentTurnIndex ? '>' : ' ';
        const type = c.type === 'player' ? 'PLY' : c.type === 'companion' ? 'ALY' : 'ENM';
        const hpDisplay = `${c.hp.current}/${c.hp.max}`;
        const conditions = c.conditions?.length > 0 ? ` [${c.conditions.map((cd: any) => cd.name || cd).join(',')}]` : '';
        lines.push(`  ${marker} ${c.name.padEnd(20)} ${type} HP:${hpDisplay.padEnd(7)} AC:${c.ac} Init:${c.initiative}${conditions}`);
    });

    lines.push(`  Round: ${combat.round || 1}`);
    return lines.join('\n');
}

/**
 * Render ASCII combat grid.
 * @ = player, 1-9 = enemies, A-Z = allies, # = blocking terrain, ~ = hazard, . = open
 */
export function renderGrid(state: GameState): string {
    const combat = state.combat;
    if (!combat || !combat.grid) return '  No combat grid.';

    const grid = combat.grid;
    const combatants = combat.combatants || [];
    const width = grid.width || 20;
    const height = grid.height || 20;

    // Build position lookup
    const posMap = new Map<string, { char: string; name: string }>();
    let enemyNum = 1;
    let allyChar = 65; // 'A'

    for (const c of combatants) {
        if (!c.position) continue;
        const key = `${c.position.x},${c.position.y}`;
        if (c.type === 'player') {
            posMap.set(key, { char: '@', name: c.name });
        } else if (c.type === 'companion' || c.type === 'summon') {
            posMap.set(key, { char: String.fromCharCode(allyChar++), name: c.name });
        } else {
            posMap.set(key, { char: String(enemyNum++), name: c.name });
        }
    }

    // Build terrain lookup
    const terrainMap = new Map<string, string>();
    const features = (grid as any).features || [];
    for (const f of features) {
        if (!f.position) continue;
        const key = `${f.position.x},${f.position.y}`;
        if (f.blocksMovement) {
            terrainMap.set(key, '#');
        } else if (f.hazard) {
            terrainMap.set(key, '~');
        } else if (f.coverBonus && f.coverBonus !== 'NONE') {
            terrainMap.set(key, '^');
        }
    }

    const lines: string[] = [];

    // Column headers
    let header = '     ';
    const colStart = Math.max(0, Math.min(...combatants.filter((c: any) => c.position).map((c: any) => c.position.x)) - 2);
    const colEnd = Math.min(width - 1, Math.max(...combatants.filter((c: any) => c.position).map((c: any) => c.position.x)) + 2);
    const rowStart = Math.max(0, Math.min(...combatants.filter((c: any) => c.position).map((c: any) => c.position.y)) - 2);
    const rowEnd = Math.min(height - 1, Math.max(...combatants.filter((c: any) => c.position).map((c: any) => c.position.y)) + 2);

    for (let x = colStart; x <= colEnd; x++) {
        header += String(x % 10);
    }
    lines.push(header);

    // Rows (top to bottom)
    for (let y = rowEnd; y >= rowStart; y--) {
        let row = `  ${String(y).padStart(2)}|`;
        for (let x = colStart; x <= colEnd; x++) {
            const key = `${x},${y}`;
            if (posMap.has(key)) {
                row += posMap.get(key)!.char;
            } else if (terrainMap.has(key)) {
                row += terrainMap.get(key)!;
            } else {
                row += '.';
            }
        }
        row += '|';
        lines.push(row);
    }

    // Legend
    lines.push('');
    const legendParts: string[] = ['  @ = You'];
    const enemies = combatants.filter((c: any) => c.type === 'enemy' && c.hp.current > 0);
    enemyNum = 1;
    for (const e of enemies) {
        legendParts.push(`${enemyNum} = ${e.name}`);
        enemyNum++;
    }
    lines.push(legendParts.join('  '));
    lines.push('  # = Wall  ^ = Cover  ~ = Hazard  . = Open');

    return lines.join('\n');
}

/**
 * Render tactical options as a numbered list.
 */
export function renderTacticalOptions(options: any[]): string {
    if (!options || options.length === 0) return '  No tactical options available.';

    const lines: string[] = ['  === Tactical Options ==='];
    options.forEach((opt: any, i: number) => {
        const typeTag = opt.type ? `[${opt.type}]` : '';
        lines.push(`  ${i + 1}. ${opt.label} ${typeTag}`);
        if (opt.description) lines.push(`     ${opt.description}`);
        if (opt.pros?.length) lines.push(`     + ${opt.pros.join(', ')}`);
        if (opt.cons?.length) lines.push(`     - ${opt.cons.join(', ')}`);

        // Sub-options
        if (opt.subOptions?.length) {
            opt.subOptions.forEach((sub: any, j: number) => {
                lines.push(`     ${i + 1}${String.fromCharCode(97 + j)}. ${sub.label}`);
                if (sub.description) lines.push(`        ${sub.description}`);
            });
        }
    });

    return lines.join('\n');
}

/**
 * Render recent combat log entries.
 */
export function renderCombatLog(state: GameState, count: number = 5): string {
    const combat = state.combat;
    if (!combat?.logs) return '';

    const logs = combat.logs.slice(-count);
    if (logs.length === 0) return '';

    const lines = ['  --- Combat Log ---'];
    for (const log of logs) {
        const typeIcon = log.type === 'success' ? '+' : log.type === 'error' ? '!' : log.type === 'warning' ? '?' : ' ';
        lines.push(`  [${typeIcon}] ${log.message}`);
    }
    return lines.join('\n');
}

/**
 * Full combat display.
 */
export function renderCombatFull(state: GameState, options?: any[]): string {
    const sections = [
        renderInitiative(state),
        '',
        renderGrid(state),
    ];

    const log = renderCombatLog(state);
    if (log) sections.push('', log);

    if (options && options.length > 0) {
        sections.push('', renderTacticalOptions(options));
    }

    return sections.join('\n');
}
