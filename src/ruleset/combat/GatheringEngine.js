import { MechanicsEngine } from './MechanicsEngine';
export class GatheringEngine {
    /**
     * Attempts to gather resources from a specific node in a hex.
     */
    static gather(pc, hex, nodeId) {
        const node = hex.resourceNodes.find(n => n.id === nodeId);
        if (!node)
            return { success: false, message: 'Resource node not found.' };
        if (node.quantityRemaining <= 0)
            return { success: false, message: 'This node is depleted.' };
        // 1. Resolve Skill Check
        if (node.skillCheck) {
            const result = MechanicsEngine.resolveCheck(pc, 'WIS', node.skillCheck.skill, node.skillCheck.dc);
            if (!result.success) {
                return { success: false, message: `Gathering failed: ${result.message}` };
            }
        }
        // 2. Extract Resource
        node.quantityRemaining--;
        // Add to inventory (simplistic for now)
        const existing = pc.inventory.items.find(i => i.id === node.itemId);
        if (existing) {
            existing.quantity++;
        }
        else {
            pc.inventory.items.push({
                id: node.itemId,
                name: node.itemId.replace(/_/g, ' '),
                weight: 0.5,
                quantity: 1,
                equipped: false
            });
        }
        return {
            success: true,
            message: `Successfully gathered 1 ${node.itemId.replace(/_/g, ' ')}. (${node.quantityRemaining} remaining)`
        };
    }
}
