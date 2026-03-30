/**
 * TradeHandler — Merchant trading display
 */

import { GameState } from '../../src/ruleset/schemas/FullSaveStateSchema';

export function renderTradeStatus(state: GameState): string {
    if (!state.activeTradeNpcId) return '  No active trade.';

    const npc = state.worldNpcs.find((n: any) => n.id === state.activeTradeNpcId);
    const lines: string[] = [];
    lines.push(`  === Trading with ${npc?.name || state.activeTradeNpcId} ===`);

    if (npc?.shopState) {
        const shop = npc.shopState;
        lines.push(`  Merchant Gold: ${shop.gold}gp`);
        if (shop.inventory?.length > 0) {
            lines.push(`  Items for sale: ${shop.inventory.length}`);
        }
    }

    const g = state.character.inventory.gold;
    lines.push(`  Your Gold: ${g.gp}gp ${g.sp}sp ${g.cp}cp`);
    lines.push(`  Commands: /buy <item>, /sell <item>, /haggle, /intimidate, /deceive, /closetrade`);

    return lines.join('\n');
}
