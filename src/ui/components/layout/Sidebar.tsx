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

    const handleItemAction = (action: string, item: any) => {
        if (!engine) return;

        if (action === 'drop') {
            engine.dropItem(item.instanceId);
            updateState();
        } else if (action === 'equip') {
            engine.equipItem(item.instanceId);
            updateState();
        } else if (action === 'pickup') {
            engine.pickupItem(item.instanceId);
            updateState();
        } else if (action === 'pickupLoot') {
            engine.pickupCombatLoot!(item.instanceId);
            updateState();
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
