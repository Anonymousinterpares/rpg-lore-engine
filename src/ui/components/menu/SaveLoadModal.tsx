import React from 'react';
import styles from './SaveLoadModal.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Save, FolderOpen, Calendar, Clock, X, Trash2 } from 'lucide-react';

interface SaveSlot {
    id: string;
    name: string;
    charName: string;
    level: number;
    location: string;
    lastSaved: string;
    playTime: string;
}

interface SaveLoadModalProps {
    mode: 'save' | 'load';
    slots: SaveSlot[];
    onAction: (id: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
    className?: string;
}

const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
    mode,
    slots,
    onAction,
    onDelete,
    onClose,
    className = ''
}) => {
    return (
        <div className={`${styles.overlay} ${className}`}>
            <div className={`${styles.modal} ${parchmentStyles.panel}`}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        {mode === 'save' ? <Save size={24} /> : <FolderOpen size={24} />}
                        <h2 className={parchmentStyles.heading}>{mode === 'save' ? 'Save Chronicle' : 'Load Chronicle'}</h2>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.slotList}>
                    {slots.map(slot => (
                        <div key={slot.id} className={styles.slotItem}>
                            <div className={styles.slotMain} onClick={() => onAction(slot.id)}>
                                <div className={styles.slotHeader}>
                                    <span className={styles.slotName}>{slot.name}</span>
                                    <span className={styles.charInfo}>{slot.charName} (Lvl {slot.level})</span>
                                </div>
                                <div className={styles.slotMeta}>
                                    <div className={styles.metaItem}>
                                        <Calendar size={12} />
                                        <span>{slot.lastSaved}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <Clock size={12} />
                                        <span>{slot.playTime}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <span>{slot.location}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                className={styles.deleteButton}
                                onClick={(e) => { e.stopPropagation(); onDelete(slot.id); }}
                                title="Delete Save"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}

                    {mode === 'save' && (
                        <button className={`${styles.newSaveSlot} ${styles.slotItem}`} onClick={() => onAction('new')}>
                            <Save size={24} />
                            <span>Create New Save Slot</span>
                        </button>
                    )}

                    {slots.length === 0 && mode === 'load' && (
                        <div className={styles.emptyState}>
                            <FolderOpen size={48} opacity={0.2} />
                            <p>No Chronicles found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SaveLoadModal;
