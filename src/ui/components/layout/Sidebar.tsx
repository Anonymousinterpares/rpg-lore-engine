import React from 'react';
import styles from './Sidebar.module.css';
import { Package } from 'lucide-react';
import CharacterPanel from '../character/CharacterPanel';
import InventoryGrid from '../inventory/InventoryGrid';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';

interface SidebarProps {
    className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
    const { state } = useGameState();

    const items = state?.character?.inventory?.items || [];
    const gold = state?.character?.inventory?.gold || { gp: 0, sp: 0, cp: 0 };

    return (
        <aside className={`${styles.sidebar} ${parchmentStyles.panel} ${className}`}>
            <CharacterPanel />
            <InventoryGrid
                items={items as any}
                gold={gold}
                className={styles.inventoryGrid}
            />
        </aside>
    );
};

export default Sidebar;
