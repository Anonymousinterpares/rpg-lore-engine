import React from 'react';
import glassStyles from '../../styles/glass.module.css';
import styles from './Header.module.css';
import { Shield, Menu, Settings, Users } from 'lucide-react';

const Header: React.FC = () => {
    return (
        <header className={styles.header}>
            <div className={styles.logo}>
                <Shield className={styles.logoIcon} />
                <h1>RPG Lore Engine</h1>
            </div>
            <div className={styles.controls}>
                <button className={glassStyles.button}>
                    <Users size={18} />
                    <span>Lobby</span>
                </button>
                <button className={glassStyles.button}>
                    <Settings size={18} />
                </button>
                <button className={glassStyles.button}>
                    <Menu size={18} />
                </button>
            </div>
        </header>
    );
};

export default Header;
