import React, { useRef, useEffect, useState } from 'react';
import styles from './ItemTooltip.module.css';
import { PaperdollItem } from './types';

interface ItemTooltipProps {
    item: PaperdollItem;
    anchorRect: DOMRect | null;
    visible: boolean;
}

const RARITY_COLORS: Record<string, string> = {
    common: '#c8c8c8',
    uncommon: '#1eff00',
    rare: '#0070dd',
    'very-rare': '#a335ee',
    legendary: '#ff8000',
};

const ItemTooltip: React.FC<ItemTooltipProps> = ({ item, anchorRect, visible }) => {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (!anchorRect || !tooltipRef.current) return;
        const tt = tooltipRef.current.getBoundingClientRect();
        let top = anchorRect.top - tt.height - 8;
        let left = anchorRect.left + anchorRect.width / 2 - tt.width / 2;

        if (top < 4) top = anchorRect.bottom + 8;
        if (left < 4) left = 4;
        if (left + tt.width > window.innerWidth - 4) left = window.innerWidth - tt.width - 4;

        setPos({ top, left });
    }, [anchorRect, visible]);

    if (!visible) return null;

    const rarityColor = RARITY_COLORS[item.rarity || 'common'];

    return (
        <div
            ref={tooltipRef}
            className={styles.tooltip}
            style={{ top: pos.top, left: pos.left }}
        >
            <div className={styles.header}>
                <span className={styles.name} style={{ color: rarityColor }}>{item.name}</span>
                {item.rarity && item.rarity !== 'common' && (
                    <span className={styles.rarity} style={{ color: rarityColor }}>
                        {item.rarity.replace('-', ' ')}
                    </span>
                )}
            </div>

            <div className={styles.typeLine}>
                {item.type}
                {item.identified === false
                    ? <span className={styles.magicBadge} style={{ background: '#555', color: '#ccc' }}>Unidentified</span>
                    : item.isMagic && <span className={styles.magicBadge}>Magic</span>
                }
                {item.attunement && <span className={styles.attuneBadge}>Attunement</span>}
            </div>

            <div className={styles.divider} />

            <div className={styles.stats}>
                {item.damage && (
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>Damage:</span>
                        <span className={styles.statValue}>{item.damage.dice} {item.damage.type}</span>
                    </div>
                )}
                {item.acBonus != null && (
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>AC Bonus:</span>
                        <span className={styles.statValue}>+{item.acBonus}</span>
                    </div>
                )}
                {item.acCalculated && (
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>AC:</span>
                        <span className={styles.statValue}>{item.acCalculated}</span>
                    </div>
                )}
                {item.range && (
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>Range:</span>
                        <span className={styles.statValue}>{item.range.normal}/{item.range.long || '—'} ft</span>
                    </div>
                )}
                {item.properties && item.properties.length > 0 && (
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>Properties:</span>
                        <span className={styles.statValue}>{item.properties.join(', ')}</span>
                    </div>
                )}
                {item.strengthReq != null && item.strengthReq > 0 && (
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>Str Required:</span>
                        <span className={styles.statValue}>{item.strengthReq}</span>
                    </div>
                )}
                {item.stealthDisadvantage && (
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>Stealth:</span>
                        <span className={styles.statValueNeg}>Disadvantage</span>
                    </div>
                )}
                <div className={styles.statRow}>
                    <span className={styles.statLabel}>Weight:</span>
                    <span className={styles.statValue}>{item.weight} lbs</span>
                </div>
                {item.quantity > 1 && (
                    <div className={styles.statRow}>
                        <span className={styles.statLabel}>Quantity:</span>
                        <span className={styles.statValue}>{item.quantity}</span>
                    </div>
                )}
            </div>

            {/* Forge Modifiers */}
            {item.modifiers && item.modifiers.length > 0 && (
                <>
                    <div className={styles.divider} />
                    <div className={styles.stats}>
                        {item.modifiers.map((mod, i) => (
                            <div key={i} className={styles.statRow}>
                                <span className={styles.statLabel} style={{ color: '#7dd3fc' }}>
                                    {mod.type === 'HitBonus' ? 'Hit Bonus:' :
                                     mod.type === 'ACBonus' ? 'AC Bonus:' :
                                     mod.type === 'DamageAdd' ? `${mod.target} Damage:` :
                                     mod.type === 'StatBonus' ? `${mod.target}:` :
                                     mod.type === 'SaveBonus' ? `${mod.target} Save:` :
                                     mod.type === 'DamageResistance' ? `${mod.target} Resistance:` :
                                     `${mod.type}:`}
                                </span>
                                <span className={styles.statValue} style={{ color: '#7dd3fc' }}>+{mod.value}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Magical Properties (hidden when unidentified) */}
            {item.identified !== false && item.magicalProperties && item.magicalProperties.length > 0 && (
                <>
                    <div className={styles.divider} />
                    {item.magicalProperties.map((mp, i) => (
                        <p key={i} className={styles.description} style={{ color: '#c4b5fd' }}>
                            {mp.description || `${mp.dice || ''} ${mp.element || ''} ${mp.type}`.trim()}
                        </p>
                    ))}
                </>
            )}

            {item.identified === false && (
                <>
                    <div className={styles.divider} />
                    <p className={styles.description} style={{ color: '#999', fontStyle: 'italic' }}>
                        This item's true nature has not been revealed. Use Examine or visit a merchant to identify.
                    </p>
                </>
            )}

            {item.identified !== false && item.description && (
                <>
                    <div className={styles.divider} />
                    <p className={styles.description}>{item.description}</p>
                </>
            )}

            {item.identified !== false && item.forgeSource && (
                <p className={styles.description} style={{ color: '#888', fontSize: '0.75rem' }}>
                    Source: {item.forgeSource}
                </p>
            )}
        </div>
    );
};

export default ItemTooltip;
