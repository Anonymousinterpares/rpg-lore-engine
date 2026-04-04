import React from 'react';
import parchmentStyles from '../../styles/parchment.module.css';
import styles from './Header.module.css';
import { Shield, Menu, Settings, Users, Book, User, BookOpen } from 'lucide-react';
import GameTooltip from '../common/GameTooltip';
import TimeDisplay from '../exploration/TimeDisplay';

interface HeaderProps {
    onLobby?: () => void;
    onSettings?: () => void;
    onCodex?: () => void;
    onCharacter?: () => void;
    onSpellbook?: () => void;
    onMenu?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLobby, onSettings, onCodex, onCharacter, onSpellbook, onMenu }) => {
    return (
        <header className={styles.header}>
            <div className={styles.logo}>
                <Shield className={styles.logoIcon} />
                <h1>RPG Lore Engine</h1>
            </div>
            <div className={styles.timeContainer}>
                <TimeDisplay />
            </div>
            <div className={styles.controls}>
                <button className={parchmentStyles.button} onClick={onLobby}>
                    <Users size={18} />
                    <span>Lobby</span>
                </button>
                <GameTooltip text="Character Sheet">
                <button className={parchmentStyles.button} onClick={onCharacter}>
                    <User size={18} />
                </button>
                </GameTooltip>
                <GameTooltip text="Spellbook">
                <button className={parchmentStyles.button} onClick={onSpellbook}>
                    <BookOpen size={18} />
                </button>
                </GameTooltip>
                <GameTooltip text="Codex">
                <button className={parchmentStyles.button} onClick={onCodex}>
                    <Book size={18} />
                </button>
                </GameTooltip>
                <GameTooltip text="Settings">
                <button className={parchmentStyles.button} onClick={onSettings}>
                    <Settings size={18} />
                </button>
                </GameTooltip>
                <GameTooltip text="Menu">
                <button className={parchmentStyles.button} onClick={onMenu}>
                    <Menu size={18} />
                </button>
                </GameTooltip>
            </div>
        </header>
    );
};

export default Header;
