import React, { useMemo } from 'react';
import styles from './TradeModal.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';
import { ShopEngine } from '../../../ruleset/combat/ShopEngine';
import { DataManager } from '../../../ruleset/data/DataManager';
import { CurrencyEngine } from '../../../ruleset/combat/CurrencyEngine';
import { ShoppingBag, Coins, Scale, Info, ShieldAlert, Heart, Zap } from 'lucide-react';
import CurrencyDisplay from '../common/CurrencyDisplay';

interface TradeModalProps {
    onClose: () => void;
    onOpenCodex?: (category: string, entryId: string) => void;
}

const TradeModal: React.FC<TradeModalProps> = ({ onClose, onOpenCodex }) => {
    const { state, engine } = useGameState();
    const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const npcId = state?.activeTradeNpcId;
    const npc = state?.worldNpcs.find(n => n.id === npcId);
    const pc = state?.character;

    if (!npc || !pc || !npc.shopState) return null;

    const standing = npc.relationship.standing;
    const merchantGold = npc.shopState.gold;
    const pcGold = pc.inventory.gold;

    // Derived stats for UI
    const charismaMod = Math.floor(((pc.stats['CHA'] || 10) - 10) / 2);
    const pcPersuasion = 10 + charismaMod + (pc.skillProficiencies.includes('Persuasion') ? (pc.level >= 17 ? 6 : pc.level >= 13 ? 5 : pc.level >= 9 ? 4 : pc.level >= 5 ? 3 : 2) : 0);
    const passiveDiscountPercent = pcPersuasion >= 20 ? 15 : pcPersuasion >= 18 ? 10 : pcPersuasion >= 15 ? 5 : 0;

    const currentWeight = pc.inventory.items.reduce((sum, i) => sum + (i.weight * (i.quantity || 1)), 0);
    const capacity = (pc.stats['STR'] || 10) * 15;

    // Item details
    const merchantInventory = useMemo(() => {
        return npc.shopState!.inventory.map(id => {
            const data = DataManager.getItem(id);
            if (!data) return null;
            const price = ShopEngine.getBuyPrice(data, npc, pc);
            const basePrice = CurrencyEngine.fromCopper(CurrencyEngine.toCopper(data.cost));
            const isBuyback = npc.shopState!.soldByPlayer.some(s => s.itemId === id && s.buybackEligible);
            const buybackData = npc.shopState!.soldByPlayer.find(s => s.itemId === id && s.buybackEligible);

            return {
                data,
                price: isBuyback ? CurrencyEngine.fromCopper(buybackData!.originalSellPrice) : price,
                basePrice,
                isBuyback,
                isDiscounted: !isBuyback && (CurrencyEngine.toCopper(price) < CurrencyEngine.toCopper(basePrice)),
                haggleLocked: !!npc.shopState!.lastHaggleFailure[id]
            };
        }).filter(Boolean);
    }, [npc.shopState?.inventory, npc.shopState?.soldByPlayer, npc.shopState?.discount, npc.shopState?.markup, pc.inventory.gold]);

    const playerInventory = useMemo(() => {
        return pc.inventory.items.map(item => {
            const data = DataManager.getItem(item.name);
            if (!data) return null;
            const price = ShopEngine.getSellPrice(data, npc, pc);
            return {
                id: item.id,
                name: item.name,
                data,
                price
            };
        }).filter(Boolean);
    }, [pc.inventory.items, npc.shopState?.discount, npc.shopState?.gold]);

    const handleAction = async (cmd: string) => {
        if (!engine) return;

        // Execute command directly to engine to get immediate feedback string
        const result = await engine.processTurn(cmd);

        // Show local toast instead of relying on narrative log
        const isError = result.includes("Insufficient") || result.includes("Too heavy") || result.includes("Not enough space") || result.includes("failed") || result.includes("remains firm") || result.includes("refuses");
        setToast({ message: result, type: isError ? 'error' : 'success' });

        // Clear toast after 1s
        setTimeout(() => setToast(null), 1000);
    };

    const handleCodexClick = () => {
        if (onOpenCodex) {
            onOpenCodex('mechanics', 'trade_system');
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={`${styles.tradeContainer} ${parchmentStyles.panel}`}>
                {toast && (
                    <div className={`${styles.toast} ${toast.type === 'error' ? styles.errorToast : styles.successToast}`}>
                        {toast.message}
                    </div>
                )}
                <div className={styles.header}>
                    <h2><ShoppingBag /> Trading with {npc.name}</h2>
                    <div className={styles.merchantMeta}>
                        <div className={styles.standingBadge}>
                            <Heart size={14} style={{ fill: standing > 0 ? '#e74c3c' : 'none' }} />
                            {standing >= 0 ? ' Friendly' : ' Hostile'} ({standing})
                        </div>
                        <div className={styles.passiveBanner}>
                            {passiveDiscountPercent > 0 && (
                                <span>🎯 Your Persuasion saves you {passiveDiscountPercent}%</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.panes}>
                    {/* Merchant Stock */}
                    <div className={styles.pane}>
                        <h3>MERCHANT STOCK <span><Coins size={14} /> {Math.floor(merchantGold)}gp</span></h3>
                        <div className={styles.itemList}>
                            {merchantInventory.map((item, idx) => (
                                <div key={`${item!.data.name}-${idx}`} className={styles.itemEntry}>
                                    <div className={styles.itemMain}>
                                        <div className={styles.itemName}>
                                            {item!.data.name}
                                            {item!.isBuyback && <span className={styles.itemBadge}>★ WAS YOURS</span>}
                                        </div>
                                        <div className={styles.itemPrice}>
                                            {item!.isDiscounted && (
                                                <span className={styles.originalPrice}>
                                                    <CurrencyDisplay currency={item!.basePrice} showTooltips={false} />
                                                </span>
                                            )}
                                            <span className={styles.currentPrice}>
                                                <CurrencyDisplay currency={item!.price} onCodexClick={handleCodexClick} />
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.itemActions}>
                                        <button
                                            className={styles.actionButton}
                                            onClick={() => handleAction(item!.isBuyback ? `/buyback ${item!.data.name}` : `/buy ${item!.data.name}`)}
                                            disabled={!CurrencyEngine.canAfford(pcGold, item!.price) || currentWeight + item!.data.weight > capacity}
                                        >
                                            {item!.isBuyback ? 'Buyback' : 'Buy'}
                                        </button>
                                        {!item!.isBuyback && (
                                            <div className={styles.tooltipTrigger}>
                                                <button
                                                    className={`${styles.actionButton} ${styles.haggleBtn}`}
                                                    onClick={() => handleAction(`/haggle ${item!.data.name}`)}
                                                    disabled={item!.haggleLocked}
                                                >
                                                    Haggle
                                                </button>
                                                <div className={styles.tooltip}>
                                                    Negotiate for a better price using Persuasion.
                                                    {item!.haggleLocked && " Failed attempt! Cooldown active."}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Player Inventory */}
                    <div className={styles.pane}>
                        <h3>YOUR INVENTORY <span><Coins size={14} /> <CurrencyDisplay currency={pcGold} onCodexClick={handleCodexClick} /></span></h3>
                        <div className={styles.itemList}>
                            {playerInventory.map((item, idx) => (
                                <div key={`${item!.id}-${idx}`} className={styles.itemEntry}>
                                    <div className={styles.itemMain}>
                                        <div className={styles.itemName}>{item!.name}</div>
                                        <div className={styles.itemPrice}>
                                            <span className={styles.currentPrice}>Sell: <CurrencyDisplay currency={item!.price} onCodexClick={handleCodexClick} /></span>
                                        </div>
                                    </div>
                                    <div className={styles.itemActions}>
                                        <button
                                            className={styles.actionButton}
                                            onClick={() => handleAction(`/sell ${item!.name}`)}
                                            disabled={merchantGold < (CurrencyEngine.toCopper(item!.price) / 100)}
                                        >
                                            Sell
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.statusInfo}>
                        <div className={`${styles.weight} ${currentWeight > capacity ? styles.weightWarning : ''}`}>
                            <Scale size={14} /> Carry: {Math.round(currentWeight)} / {capacity} lbs
                        </div>
                    </div>

                    <div className={styles.specialActions}>
                        <div className={styles.tooltipTrigger}>
                            <button
                                className={styles.specialBtn}
                                onClick={() => handleAction('/intimidate')}
                            >
                                <Zap size={16} /> Intimidate
                                <div className={styles.tooltip}>
                                    Force a permanent discount via Intimidation.
                                    Risky: Failure destroys relationship.
                                </div>
                            </button>
                        </div>
                        <div className={styles.tooltipTrigger}>
                            <button
                                className={styles.specialBtn}
                                onClick={() => handleAction('/deceive')}
                            >
                                <Info size={16} /> Deceive
                                <div className={styles.tooltip}>
                                    Lie about your items to get 20% more gold.
                                    Critical Failure results in being banned from shop.
                                </div>
                            </button>
                        </div>
                    </div>

                    <button className={styles.closeTrade} onClick={() => handleAction('/closetrade')}>
                        🚪 Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TradeModal;
