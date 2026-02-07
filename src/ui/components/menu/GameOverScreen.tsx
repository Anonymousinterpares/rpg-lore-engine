import React, { useEffect } from 'react';
import styles from './GameOverScreen.module.css';
import { RotateCcw, FolderOpen, Home } from 'lucide-react';

interface GameOverScreenProps {
    onLoadLastSave: () => void;
    onLoadGame: () => void;
    onReturnToMenu: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({
    onLoadLastSave,
    onLoadGame,
    onReturnToMenu
}) => {
    // Disable scrolling and other interactions
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Prevent escape key from closing (if handled at window level)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, []);

    return (
        <div className={styles.overlay}>
            <div className={styles.content}>
                <h1 className={styles.title}>YOU HAVE DIED</h1>
                <p className={styles.subtitle}>Your chronicle reaches a silent conclusion.</p>

                <div className={styles.choiceList}>
                    <button className={styles.choiceButton} onClick={onLoadLastSave}>
                        <RotateCcw size={20} className={styles.icon} />
                        <span>Load Last Checkpoint</span>
                    </button>

                    <button className={styles.choiceButton} onClick={onLoadGame}>
                        <FolderOpen size={20} className={styles.icon} />
                        <span>Open Save Register</span>
                    </button>

                    <button className={styles.choiceButton} onClick={onReturnToMenu}>
                        <Home size={20} className={styles.icon} />
                        <span>Return to Title Screen</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameOverScreen;
