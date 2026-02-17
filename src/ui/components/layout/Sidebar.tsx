import React from 'react';
import styles from './Sidebar.module.css';
import { Package } from 'lucide-react';
import CharacterPanel from '../character/CharacterPanel';
import InventoryGrid from '../inventory/InventoryGrid';
import LocationPanel from '../exploration/LocationPanel';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';

interface SidebarProps {
    className?: string;
    onCharacter?: () => void;
    onCompass?: () => void;
    onCodex?: (category?: string, entryId?: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ className, onCharacter, onCompass, onCodex }) => {
    const { state, engine, updateState } = useGameState();

    const items = state?.character?.inventory?.items || [];
    const gold = state?.character?.inventory?.gold || { gp: 0, sp: 0, cp: 0 };

    const currentHex = state?.worldMap?.hexes[state?.location?.hexId];

    // D&D 5e: Carrying Capacity = Strength Score * 15 lbs
    const strScore = state?.character?.stats?.STR || 10;
    const capacity = strScore * 15;

    const handleItemAction = async (action: string, item: any) => {
        if (!engine) return;

        if (action === 'drop') {
            await engine.dropItem(item.instanceId);
        } else if (action === 'equip') {
            await engine.equipItem(item.instanceId);
        } else if (action === 'pickup') {
            await engine.pickupItem(item.instanceId);
        } else if (action === 'pickupLoot') {
            await engine.pickupCombatLoot!(item.instanceId);
        }
    };

    // Derive talking state from game state instead of managing local ephemeral state
    const talkingNpcId = state?.activeDialogueNpcId || null;

    return (
        <aside className={`${styles.sidebar} ${parchmentStyles.panel} ${parchmentStyles.overflowVisible} ${className}`}>
            {currentHex && (
                <LocationPanel
                    name={currentHex.name || 'Uncharted Territory'}
                    biome={currentHex.biome || 'Plains'}
                    description={currentHex.description || ''}
                    interestPoints={currentHex.interest_points || []}
                    resourceNodes={currentHex.resourceNodes || []}
                    npcs={(currentHex.npcs || []).map(npcId => {
                        const npc = state.worldNpcs.find(n => n.id === npcId);
                        return {
                            id: npcId,
                            name: npc?.name || 'Unknown NPC',
                            role: npc?.role,
                            factionId: npc?.factionId,
                            isMerchant: npc?.isMerchant || false,
                            standing: npc?.relationship?.standing ?? 0
                        };
                    })}
                    talkingNpcId={talkingNpcId}
                    onTalkToNpc={async (npcId) => {
                        if (engine) {
                            if (npcId === '__end__') {
                                await engine.processTurn('/endtalk');
                                return;
                            }
                            await engine.processTurn(`/talk ${npcId}`);
                        }
                    }}
                    onTradeWithNpc={async (npcId) => {
                        if (engine) {
                            await engine.processTurn(`/trade ${npcId}`);
                        }
                    }}
                    connections={currentHex.connections}
                    onCompassClick={onCompass}
                    onCodex={onCodex} // Pass down for future use (e.g. clicking biome/faction badges)
                />
            )}
            <CharacterPanel onCharacter={onCharacter} />
            <InventoryGrid
                items={items as any}
                gold={gold as any}
                capacity={capacity}
                droppedItems={state?.location?.droppedItems as any}
                combatLoot={state?.location?.combatLoot as any}
                maxSlots={20}
                onItemAction={handleItemAction}
                className={styles.inventoryGrid}
            />
        </aside>
    );
};

export default Sidebar;
