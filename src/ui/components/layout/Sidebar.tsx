import React from 'react';
import styles from './Sidebar.module.css';
import { Package } from 'lucide-react';
import CharacterPanel from '../character/CharacterPanel';
import parchmentStyles from '../../styles/parchment.module.css';

interface SidebarProps {
    className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
    return (
        <aside className={`${styles.sidebar} ${parchmentStyles.panel} ${className}`}>
            <CharacterPanel />
            <div className={styles.inventory}>
                <h3>Inventory</h3>
                <div className={styles.placeholder}>Items will appear here</div>
            </div>
        </aside>
    );
};

export default Sidebar;
