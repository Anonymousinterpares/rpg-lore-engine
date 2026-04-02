import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { Hex, ResourceNode } from '../schemas/HexMapSchema';
import { MechanicsEngine } from './MechanicsEngine';
import { SkillAbilityEngine } from './SkillAbilityEngine';

export class GatheringEngine {
    /**
     * Attempts to gather resources from a specific node in a hex.
     */
    public static gather(pc: PlayerCharacter, hex: Hex, nodeId: string): { success: boolean, message: string } {
        const node = hex.resourceNodes.find(n => n.id === nodeId);
        if (!node) return { success: false, message: 'Resource node not found.' };
        if (node.quantityRemaining <= 0) return { success: false, message: 'This node is depleted.' };

        // 1. Resolve Skill Check
        if (node.skillCheck) {
            const result = MechanicsEngine.resolveCheck(pc, 'WIS', node.skillCheck.skill, node.skillCheck.dc);
            if (!result.success) {
                return { success: false, message: `Gathering failed: ${result.message}` };
            }
        }

        // 2. Extract Resource
        node.quantityRemaining--;

        // Nature T3 passive: +50% yield (gather 2 instead of 1 if node has stock)
        let gatherQty = 1;
        if (SkillAbilityEngine.hasPassiveAbility(pc, 'Nature', 3) && node.quantityRemaining > 0) {
            gatherQty = 2;
            node.quantityRemaining--; // Take extra
        }
        // Nature T4 passive: max yield (take all remaining)
        if (SkillAbilityEngine.hasPassiveAbility(pc, 'Nature', 4)) {
            gatherQty = node.quantityRemaining + gatherQty; // All remaining + current
            node.quantityRemaining = 0;
        }

        // Add to inventory
        const existing = pc.inventory.items.find(i => i.id === node.itemId);
        if (existing) {
            existing.quantity += gatherQty;
        } else {
            pc.inventory.items.push({
                id: node.itemId,
                name: node.itemId.replace(/_/g, ' '),
                weight: 0.5,
                quantity: gatherQty,
                equipped: false
            } as any);
        }

        return {
            success: true,
            message: `Successfully gathered ${gatherQty} ${node.itemId.replace(/_/g, ' ')}. (${node.quantityRemaining} remaining)`
        };
    }
}
