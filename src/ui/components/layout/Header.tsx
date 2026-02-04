import React from 'react';
import parchmentStyles from '../../styles/parchment.module.css';
import styles from './Header.module.css';
import { Shield, Menu, Settings, Users, Book, User, Backpack } from 'lucide-react';

interface HeaderProps {
    onLobby?: () => void;
    onSettings?: () => void;
    onCodex?: () => void;
    onCharacter?: () => void;
    onEquipment?: () => void;
    onMenu?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLobby, onSettings, onCodex, onCharacter, onEquipment, onMenu }) => {
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
                <button className={parchmentStyles.button} onClick={onCharacter} title="Character Sheet">
                    <User size={18} />
                </button>
                <button className={parchmentStyles.button} onClick={onEquipment} title="Equipment">
                    <Backpack size={18} />
                </button>
                <button className={parchmentStyles.button} onClick={onCodex} title="Codex">
                    <Book size={18} />
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
