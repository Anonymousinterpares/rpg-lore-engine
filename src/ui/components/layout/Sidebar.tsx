import React from 'react';
import styles from './Sidebar.module.css';
import { Package } from 'lucide-react';
import CharacterPanel from '../character/CharacterPanel';
import InventoryGrid from '../inventory/InventoryGrid';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';

interface SidebarProps {
    className?: string;
    onCharacter?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ className, onCharacter }) => {
    const { state, engine, updateState } = useGameState();

    const items = state?.character?.inventory?.items || [];
    const gold = state?.character?.inventory?.gold || { gp: 0, sp: 0, cp: 0 };

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

    return (
        <aside className={`${styles.sidebar} ${parchmentStyles.panel} ${parchmentStyles.overflowVisible} ${className}`}>
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
