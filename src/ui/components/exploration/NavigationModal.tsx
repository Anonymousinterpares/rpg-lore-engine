import React from 'react';
import styles from './NavigationModal.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Map as MapIcon, Compass, Wind, Plane, EyeOff } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';

interface NavigationModalProps {
    onClose: () => void;
}

const NavigationModal: React.FC<NavigationModalProps> = ({ onClose }) => {
    const { state, engine } = useGameState();

    if (!state) return null;

    const isBlind = state.worldTime.totalTurns < state.explorationBlindnessUntil;
    const knownSpells = state.character.knownSpells || [];

    const handleAction = async (cmd: string) => {
        if (engine) {
            await engine.processTurn(cmd);
            onClose();
        }
    };

    const explorationSpells = [
        { name: 'Find the Path', icon: <Compass size={24} />, cmd: '/cast "Find the Path"', level: 2 },
        { name: 'Teleport', icon: <Plane size={24} />, cmd: '/cast "Teleport"', level: 7 },
        { name: 'Misty Step', icon: <Wind size={24} />, cmd: '/cast "Misty Step"', level: 2 }
    ].filter(s => knownSpells.includes(s.name));

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={`${styles.modal} ${parchmentStyles.panel}`} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2> Exploration & Navigation</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                {isBlind && (
                    <div className={styles.blindnessWarning}>
                        <EyeOff size={16} />
                        <div>
                            <strong>Exploration Blindness Active:</strong>
                            <br />
                            High-tier navigation spells are blocked.
                        </div>
                    </div>
                )}

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Mental & Physical Skills</h3>
                    <div className={styles.actionGrid}>
                        <button
                            className={styles.actionButton}
                            onClick={() => handleAction('/survey')}
                            title="Survey the surroundings to reveal hidden paths and uncharted terrain features. Requires Cartographer's tools, Ink, and Parchment."
                        >
                            <MapIcon size={24} className={styles.actionIcon} />
                            <span className={styles.actionName}>Survey Area</span>
                            <span className={styles.actionCost}>Uses Supplies</span>
                        </button>
                    </div>
                </div>

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Magical Utilities</h3>
                    <div className={styles.actionGrid}>
                        {explorationSpells.length === 0 ? (
                            <div className={styles.actionCost}>No exploration spells known.</div>
                        ) : (
                            explorationSpells.map(spell => {
                                const isDisabled = isBlind && spell.level >= 3;
                                return (
                                    <button
                                        key={spell.name}
                                        className={styles.actionButton}
                                        onClick={() => handleAction(spell.cmd)}
                                        disabled={isDisabled}
                                        title={isDisabled ? "Blocked by Exploration Blindness" : `Cast ${spell.name}`}
                                    >
                                        <div className={styles.actionIcon}>{spell.icon}</div>
                                        <span className={styles.actionName}>{spell.name}</span>
                                        <span className={styles.actionCost}>Level {spell.level}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NavigationModal;
