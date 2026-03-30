/**
 * EquipmentHandler — Equipment slot display
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

const SLOT_DISPLAY_ORDER = [
    'head', 'neck', 'shoulders', 'armor', 'cloak', 'belt', 'bracers',
    'gloves', 'legs', 'feet', 'mainHand', 'offHand', 'ammunition',
    'leftRing1', 'leftRing2', 'leftRing3', 'leftRing4', 'leftRing5',
    'rightRing1', 'rightRing2', 'rightRing3', 'rightRing4', 'rightRing5'
];

export function renderPaperdoll(state: GameState): string {
    const c = state.character;
    const slots = c.equipmentSlots || {};
    const items = c.inventory.items;
    const lines: string[] = ['  === Equipment (Paperdoll) ==='];

    let hasEquipment = false;
    for (const slotName of SLOT_DISPLAY_ORDER) {
        const instanceId = (slots as any)[slotName];
        if (instanceId) {
            const item = items.find((i: any) => i.instanceId === instanceId);
            lines.push(`  ${slotName.padEnd(15)} ${item?.name || instanceId}`);
            hasEquipment = true;
        }
    }

    if (!hasEquipment) {
        lines.push('  (no equipment)');
    }

    lines.push(`\n  AC: ${c.ac}`);
    return lines.join('\n');
}
