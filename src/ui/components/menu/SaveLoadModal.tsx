import React, { useState } from 'react';
import styles from './SaveLoadModal.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Save, FolderOpen, Calendar, Clock, X, Trash2, MapPin, Plus } from 'lucide-react';

interface SaveSlot {
    id: string;
    name: string;
    charName: string;
    level: number;
    location: string;
    lastSaved: string;
    playTime: string;
    narrativeSummary?: string;
    thumbnail?: string;
}

interface SaveLoadModalProps {
    mode: 'save' | 'load';
    slots: SaveSlot[];
    onAction: (id: string, name?: string) => void;
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
    const [newSaveName, setNewSaveName] = useState(`Chronicle ${new Date().toLocaleDateString()}`);

    return (
        <div className={`${styles.overlay} ${className}`}>
            <div className={`${styles.modal} ${parchmentStyles.panel}`}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        {mode === 'save' ? <Save size={24} color="#4a3c31" /> : <FolderOpen size={24} color="#4a3c31" />}
                        <h2 className={styles.title}>{mode === 'save' ? 'Save Chronicle' : 'Load Chronicle'}</h2>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}><X size={24} /></button>
                </div>

                {mode === 'save' && (
                    <div className={styles.createSection}>
                        <div className={parchmentStyles.text} style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                            Begin a new chapter in your history...
                        </div>
                        <div className={styles.createControls}>
                            <input
                                type="text"
                                className={styles.nameInput}
                                value={newSaveName}
                                onChange={(e) => setNewSaveName(e.target.value)}
                                placeholder="Name your save..."
                                maxLength={30}
                            />
                            <button
                                className={styles.createButton}
                                onClick={() => onAction('new', newSaveName)}
                                disabled={!newSaveName.trim()}
                            >
                                <Plus size={18} />
                                <span>Create New Save</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className={styles.slotList}>
                    {slots.length === 0 && (
                        <div className={styles.emptyState}>
                            <FolderOpen size={48} opacity={0.3} />
                            <p>No Chronicles found</p>
                            {mode === 'save' && <span style={{ fontSize: '0.9rem' }}>Create one above!</span>}
                        </div>
                    )}

                    {slots.map(slot => (
                        <div key={slot.id} className={styles.slotItem}>
                            <div className={styles.slotMain} onClick={() => onAction(slot.id)}>
                                <div className={styles.slotHeader}>
                                    <span className={styles.slotName}>{slot.name}</span>
                                    <span className={styles.charInfo}>{slot.charName} (Lvl {slot.level})</span>
                                </div>
                                <div className={styles.slotMeta}>
                                    <div className={styles.slotInfoPane}>
                                        <div className={styles.metaItem}>
                                            <Calendar size={12} />
                                            <span>{slot.lastSaved}</span>
                                        </div>
                                        <div className={styles.metaItem}>
                                            <Clock size={12} />
                                            <span>{slot.playTime}</span>
                                        </div>
                                        <div className={styles.metaItem}>
                                            <MapPin size={12} />
                                            <span>{slot.location}</span>
                                        </div>
                                    </div>

                                    {slot.narrativeSummary && (
                                        <p className={styles.slotSummary}>{slot.narrativeSummary}</p>
                                    )}
                                </div>
                            </div>
                            <div className={styles.slotRight}>
                                {slot.thumbnail ? (
                                    <div className={styles.thumbnailContainer}>
                                        <img src={slot.thumbnail} alt="Snapshot" className={styles.saveThumbnail} />
                                    </div>
                                ) : (
                                    <div className={styles.thumbnailContainer} style={{ background: '#3e352f' }}>
                                        <MapPin size={24} color="rgba(255,255,255,0.2)" />
                                    </div>
                                )}
                                <button
                                    className={styles.deleteButton}
                                    onClick={(e) => { e.stopPropagation(); onDelete(slot.id); }}
                                    title="Delete Save"
                                >
                                    <Trash2 size={16} />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SaveLoadModal;
