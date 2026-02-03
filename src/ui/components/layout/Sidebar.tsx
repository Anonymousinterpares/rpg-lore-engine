import React from 'react';
import glassStyles from '../../styles/glass.module.css';
import styles from './Sidebar.module.css';
import { Package } from 'lucide-react';
import CharacterPanel from '../character/CharacterPanel';

interface SidebarProps {
    className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
    return (
        <aside className={`${styles.sidebar} ${className}`}>
            <CharacterPanel />

            <div className={glassStyles.panel}>
                <div className={styles.sectionHeader}>
                    <Package size={18} />
                    <h2>Inventory</h2>
                </div>
                <div className={styles.placeholder}>Inventory Grid Placeholder</div>
            </div>
        </aside>
    );
};

export default Sidebar;
