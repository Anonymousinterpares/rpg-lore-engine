import React from 'react';
import styles from './ItemDatasheet.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Weight, Coins, Shield, Sword } from 'lucide-react';
import ReactDOM from 'react-dom';
import { useGameState } from '../../hooks/useGameState';

interface Item {
    id: string;
    name: string;
    type: string;
    weight: number;
    description?: string;
    cost?: { gp: number, sp: number, cp: number };
    damage?: string | { dice: string, type: string };
    ac?: number;
    properties?: string[];
}

interface ItemDatasheetProps {
    item: Item;
    onClose: () => void;
}

const ItemDatasheet: React.FC<ItemDatasheetProps> = ({ item, onClose }) => {
    const { engine, updateState } = useGameState();

    React.useEffect(() => {
        if (engine) {
            engine.trackTutorialEvent(`examined_item:${item.name}`);
            updateState();
        }
    }, [engine, item.name, updateState]);

    // Render into portal to document.body to avoid stacking issues
    return ReactDOM.createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={`${styles.sheet} ${parchmentStyles.panel}`} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose}>
                    <X size={20} />
                </button>

                <div className={styles.header}>
                    <h2 className={styles.name}>{item.name}</h2>
                    <div className={styles.type}>{item.type}</div>
                </div>

                <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                        <Weight size={14} />
                        <span>{item.weight} lb</span>
                    </div>
                    {item.cost && (
                        <div className={styles.infoItem}>
                            <Coins size={14} />
                            <span>
                                {item.cost.gp > 0 && `${item.cost.gp}gp `}
                                {item.cost.sp > 0 && `${item.cost.sp}sp `}
                                {item.cost.cp > 0 && `${item.cost.cp}cp `}
                            </span>
                        </div>
                    )}
                </div>

                <div className={styles.content}>
                    {(item.damage || item.ac !== undefined) && (
                        <div className={styles.statsSection}>
                            {item.damage && (
                                <div className={styles.statLine}>
                                    <Sword size={14} />
                                    <strong>Damage:</strong> {typeof item.damage === 'object' ? `${item.damage.dice} ${item.damage.type}` : item.damage}
                                </div>
                            )}
                            {item.ac !== undefined && (
                                <div className={styles.statLine}>
                                    <Shield size={14} />
                                    <strong>AC Bonus:</strong> +{item.ac}
                                </div>
                            )}
                        </div>
                    )}

                    {item.properties && item.properties.length > 0 && (
                        <div className={styles.properties}>
                            {item.properties.map(p => (
                                <span key={p} className={styles.propertyBadge}>{p}</span>
                            ))}
                        </div>
                    )}

                    <div className={styles.divider} />

                    <div className={styles.description}>
                        {item.description || "No description available."}
                    </div>
                </div>

                <div className={styles.footer}>
                    Right-click for more actions
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ItemDatasheet;
