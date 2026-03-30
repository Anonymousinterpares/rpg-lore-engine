/**
 * InventoryRenderer — Items, gold, weight, equipment slots
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

export function renderInventory(state: GameState): string {
    const c = state.character;
    const inv = c.inventory;
    const lines: string[] = [];

    // Gold
    const g = inv.gold;
    const goldParts: string[] = [];
    if (g.pp > 0) goldParts.push(`${g.pp}pp`);
    if (g.gp > 0) goldParts.push(`${g.gp}gp`);
    if (g.ep > 0) goldParts.push(`${g.ep}ep`);
    if (g.sp > 0) goldParts.push(`${g.sp}sp`);
    if (g.cp > 0) goldParts.push(`${g.cp}cp`);
    lines.push(`  Gold: ${goldParts.length > 0 ? goldParts.join(' ') : '0gp'}`);

    // Weight
    const totalWeight = inv.items.reduce((sum: number, item: any) => sum + (item.weight || 0) * (item.quantity || 1), 0);
    const capacity = (c.stats.STR || 10) * 15;
    lines.push(`  Weight: ${totalWeight.toFixed(1)}/${capacity} lbs`);

    // Items table
    if (inv.items.length === 0) {
        lines.push('  Inventory: (empty)');
    } else {
        lines.push(`  Inventory (${inv.items.length} items):`);
        lines.push(`    ${'Name'.padEnd(25)} ${'Qty'.padStart(3)} ${'Wt'.padStart(5)} ${'Equipped'.padStart(8)}`);
        lines.push(`    ${'-'.repeat(25)} ${'-'.repeat(3)} ${'-'.repeat(5)} ${'-'.repeat(8)}`);
        for (const item of inv.items) {
            const name = (item.name || item.id || '???').slice(0, 25);
            const qty = String(item.quantity || 1);
            const wt = ((item.weight || 0) * (item.quantity || 1)).toFixed(1);
            const eq = item.equipped ? 'YES' : '';
            lines.push(`    ${name.padEnd(25)} ${qty.padStart(3)} ${wt.padStart(5)} ${eq.padStart(8)}`);
        }
    }

    // Equipment Slots
    const slots = c.equipmentSlots || {};
    const filledSlots = Object.entries(slots).filter(([_, v]) => v);
    if (filledSlots.length > 0) {
        lines.push(`\n  Equipment Slots:`);
        for (const [slot, instanceId] of filledSlots) {
            const item = inv.items.find((i: any) => i.instanceId === instanceId);
            lines.push(`    ${slot.padEnd(15)} ${item?.name || instanceId}`);
        }
    }

    return lines.join('\n');
}
