import React, { useState } from 'react';
import styles from './ShopInterface.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { ShoppingCart, ArrowLeftRight, X } from 'lucide-react';

interface Item {
    id: string;
    name: string;
    type: string;
    quantity: number;
    cost: { gp: number, sp: number, cp: number };
}

interface ShopInterfaceProps {
    merchantName: string;
    merchantItems: Item[];
    playerItems: Item[];
    playerGold: { gp: number, sp: number, cp: number };
    onBuy: (itemId: string) => void;
    onSell: (itemId: string) => void;
    onClose: () => void;
    className?: string;
}

const ShopInterface: React.FC<ShopInterfaceProps> = ({
    merchantName,
    merchantItems,
    playerItems,
    playerGold,
    onBuy,
    onSell,
    onClose,
    className = ''
}) => {
    const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

    return (
        <div className={`${styles.overlay} ${className}`}>
            <div className={`${styles.modal} ${parchmentStyles.panel}`}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <ShoppingCart size={20} className={styles.icon} />
                        <h2 className={parchmentStyles.heading}>{merchantName}'s Shop</h2>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'buy' ? styles.activeTab : ''} ${parchmentStyles.button}`}
                        onClick={() => setActiveTab('buy')}
                    >
                        Buy
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'sell' ? styles.activeTab : ''} ${parchmentStyles.button}`}
                        onClick={() => setActiveTab('sell')}
                    >
                        Sell
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.gridSection}>
                        <div className={styles.sectionHeader}>
                            <span>{activeTab === 'buy' ? 'Merchant Stock' : 'Your Inventory'}</span>
                            <div className={styles.gold}>
                                <span>Current Gold: {playerGold.gp}g {playerGold.sp}s {playerGold.cp}c</span>
                            </div>
                        </div>

                        <div className={styles.itemList}>
                            {(activeTab === 'buy' ? merchantItems : playerItems).map(item => (
                                <div key={item.id} className={styles.itemRow}>
                                    <div className={styles.itemInfo}>
                                        <span className={styles.itemName}>{item.name}</span>
                                        <span className={styles.itemType}>{item.type}</span>
                                    </div>
                                    <div className={styles.actions}>
                                        <div className={styles.cost}>
                                            {item.cost.gp}g {item.cost.sp}s {item.cost.cp}c
                                        </div>
                                        <button
                                            className={`${styles.actionButton} ${parchmentStyles.button}`}
                                            onClick={() => activeTab === 'buy' ? onBuy(item.id) : onSell(item.id)}
                                        >
                                            {activeTab === 'buy' ? 'Buy' : 'Sell'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopInterface;
