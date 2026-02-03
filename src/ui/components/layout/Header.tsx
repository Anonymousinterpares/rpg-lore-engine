import React from 'react';
import parchmentStyles from '../../styles/parchment.module.css';
import styles from './Header.module.css';
import { Shield, Menu, Settings, Users } from 'lucide-react';

interface HeaderProps {
    onLobby?: () => void;
    onSettings?: () => void;
    onMenu?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLobby, onSettings, onMenu }) => {
    return (
        <header className={styles.header}>
            <div className={styles.logo}>
                <Shield className={styles.logoIcon} />
                <h1>RPG Lore Engine</h1>
            </div>
            <div className={styles.controls}>
                <button className={parchmentStyles.button} onClick={onLobby}>
                    <Users size={18} />
                    <span>Lobby</span>
                </button>
                <button className={parchmentStyles.button} onClick={onSettings}>
                    <Settings size={18} />
                </button>
                <button className={parchmentStyles.button} onClick={onMenu}>
                    <Menu size={18} />
                </button>
            </div>
        </header>
    );
};

export default Header;
