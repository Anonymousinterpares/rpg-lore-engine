import React from 'react';
import styles from './MainMenu.module.css';
import { Play, FolderOpen, Settings, Users, LogOut, Save } from 'lucide-react';

interface MainMenuProps {
    onNewGame: () => void;
    onSaveGame?: () => void;
    onLoadGame: () => void;
    onSettings: () => void;
    onMultiplayer: () => void;
    onQuit: () => void;
    className?: string;
    isActive?: boolean;
}

const MainMenu: React.FC<MainMenuProps> = ({
    onNewGame,
    onSaveGame,
    onLoadGame,
    onSettings,
    onMultiplayer,
    onQuit,
    className = '',
    isActive = false
}) => {
    return (
        <div className={`${styles.container} ${className}`}>
            <div className={styles.overlay} />

            <div className={styles.content}>
                <h1 className={styles.gameTitle}>RPG LORE ENGINE</h1>

                <div className={styles.menuList}>
                    <button className={styles.menuButton} onClick={onNewGame}>
                        <Play size={20} />
                        <span>New Adventure</span>
                    </button>

                    {isActive && onSaveGame && (
                        <button className={`${styles.menuButton} ${styles.saveButton}`} onClick={onSaveGame}>
                            <Save size={20} />
                            <span>Save Adventure</span>
                        </button>
                    )}

                    <button className={styles.menuButton} onClick={onLoadGame}>
                        <FolderOpen size={20} />
                        <span>Load Chronicle</span>
                    </button>

                    <button className={styles.menuButton} onClick={onMultiplayer}>
                        <Users size={20} />
                        <span>Multiplayer Lobby</span>
                    </button>

                    <button className={styles.menuButton} onClick={onSettings}>
                        <Settings size={20} />
                        <span>Settings</span>
                    </button>

                    <button className={styles.menuButton} onClick={onQuit}>
                        <LogOut size={20} />
                        <span>Quit to Desktop</span>
                    </button>
                </div>

                <div className={styles.footer}>
                    <span>Build v1.0.0</span>
                    <span>© 2026 Advanced Agentic Coding</span>
                </div>
            </div>
        </div>
    );
};

export default MainMenu;
