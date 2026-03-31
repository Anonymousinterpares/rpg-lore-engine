import React from 'react';
import styles from './ItemDatasheet.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Weight, Coins, Shield, Sword, Target } from 'lucide-react';
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
    range?: { normal: number, long?: number };
    // Forge fields
    rarity?: string;
    modifiers?: { type: string; target: string; value: number }[];
    magicalProperties?: { type: string; element?: string; value?: number; dice?: string; spellName?: string; maxCharges?: number; description?: string }[];
    isForged?: boolean;
    forgeSource?: string;
    isMagic?: boolean;
    identified?: boolean;
    trueName?: string;
    trueRarity?: string;
    lore?: string;
}

interface ItemDatasheetProps {
    item: Item;
    onClose: () => void;
}

const ItemDatasheet: React.FC<ItemDatasheetProps> = ({ item, onClose }) => {
    const { engine, updateState } = useGameState();

    React.useEffect(() => {
        const trackEvent = async () => {
            if (engine) {
                await engine.trackTutorialEvent(`examined_item:${item.name}`);
                updateState();
            }
        };
        trackEvent();
    }, [engine, item.name, updateState]);

    // Render into portal to document.body to avoid stacking issues
    return ReactDOM.createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={`${styles.sheet} ${parchmentStyles.panel}`} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose}>
                    <X size={20} />
                </button>

                <div className={styles.header}>
                    <h2 className={styles.name} style={item.rarity ? { color: ({
                        'Common': '#c8c8c8', 'Uncommon': '#1eff00', 'Rare': '#0070dd',
                        'Very Rare': '#a335ee', 'Legendary': '#ff8000',
                    } as any)[item.rarity] || '#c8c8c8' } : undefined}>{item.name}</h2>
                    <div className={styles.type}>
                        {item.type}
                        {item.rarity && item.rarity !== 'Common' && (
                            <span style={{ marginLeft: 8, color: ({
                                'Uncommon': '#1eff00', 'Rare': '#0070dd',
                                'Very Rare': '#a335ee', 'Legendary': '#ff8000',
                            } as any)[item.rarity], fontWeight: 600 }}>
                                {item.rarity}
                            </span>
                        )}
                        {item.isMagic && <span style={{ marginLeft: 8, color: '#c4b5fd' }}>Magic</span>}
                    </div>
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
                            {item.range && (
                                <div className={styles.statLine}>
                                    <Target size={14} />
                                    <strong>Range:</strong> {item.range.normal}ft (Normal) / {item.range.long || item.range.normal}ft (Max)
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

                    {/* Forge Modifiers */}
                    {item.modifiers && item.modifiers.length > 0 && (
                        <div className={styles.statsSection}>
                            {item.modifiers.map((mod, i) => (
                                <div key={i} className={styles.statLine} style={{ color: '#7dd3fc' }}>
                                    <strong>
                                        {mod.type === 'HitBonus' ? 'Hit Bonus' :
                                         mod.type === 'ACBonus' ? 'AC Bonus' :
                                         mod.type === 'DamageAdd' ? `${mod.target} Damage` :
                                         mod.type === 'StatBonus' ? mod.target :
                                         mod.type === 'SaveBonus' ? `${mod.target} Save` :
                                         mod.type === 'DamageResistance' ? `${mod.target} Resistance` :
                                         mod.type}:
                                    </strong> +{mod.value}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Magical Properties (hidden when unidentified) */}
                    {item.identified !== false && item.magicalProperties && item.magicalProperties.length > 0 && (
                        <div className={styles.statsSection}>
                            {item.magicalProperties.map((mp, i) => (
                                <div key={i} className={styles.statLine} style={{ color: '#c4b5fd' }}>
                                    {mp.description || `${mp.dice || ''} ${mp.element || ''} ${mp.type}`.trim()}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={styles.divider} />

                    {item.identified === false ? (
                        <div className={styles.description} style={{ color: '#999', fontStyle: 'italic' }}>
                            This item's true nature has not been revealed. Use Examine or visit a merchant to identify.
                        </div>
                    ) : (
                        <div className={styles.description}>
                            {item.description || "No description available."}
                        </div>
                    )}

                    {item.identified !== false && item.forgeSource && (
                        <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 8, fontStyle: 'italic' }}>
                            Source: {item.forgeSource}
                        </div>
                    )}
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
