import React from 'react';
import { Currency } from '../../../ruleset/combat/CurrencyEngine';
import styles from './CurrencyDisplay.module.css';

interface CurrencyDisplayProps {
    currency: Currency;
    showTooltips?: boolean;
    onCodexClick?: () => void;
}

const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ currency, showTooltips = true, onCodexClick }) => {
    const parts: { value: number; unit: string; color: string; tooltip: string }[] = [];

    if (currency.pp > 0) parts.push({ value: currency.pp, unit: 'pp', color: '#e8e8e8', tooltip: 'Platinum Pieces (10gp each)' });
    if (currency.gp > 0) parts.push({ value: currency.gp, unit: 'gp', color: '#ffd700', tooltip: 'Gold Pieces (standard currency)' });
    if (currency.ep > 0) parts.push({ value: currency.ep, unit: 'ep', color: '#c0c0c0', tooltip: 'Electrum Pieces (0.5gp each)' });
    if (currency.sp > 0) parts.push({ value: currency.sp, unit: 'sp', color: '#b0b0b0', tooltip: 'Silver Pieces (0.1gp each)' });
    if (currency.cp > 0) parts.push({ value: currency.cp, unit: 'cp', color: '#cd7f32', tooltip: 'Copper Pieces (0.01gp each)' });

    if (parts.length === 0) {
        return <span className={styles.emptyPurse}>Empty</span>;
    }

    return (
        <span className={styles.currencyDisplay}>
            {parts.map((part, idx) => (
                <React.Fragment key={part.unit}>
                    {idx > 0 && <span className={styles.separator}>, </span>}
                    {showTooltips ? (
                        <span
                            className={styles.coinGroup}
                            title={part.tooltip}
                            onClick={onCodexClick}
                            style={{ cursor: onCodexClick ? 'pointer' : 'default' }}
                        >
                            <span className={styles.coinValue}>{part.value}</span>
                            <span
                                className={styles.coinUnit}
                                data-unit={part.unit}
                                style={{ fontWeight: 'bold' }}
                            >
                                {part.unit}
                            </span>
                        </span>
                    ) : (
                        <span className={styles.coinGroup}>
                            <span className={styles.coinValue}>{part.value}</span>
                            <span
                                className={styles.coinUnit}
                                data-unit={part.unit}
                                style={{ fontWeight: 'bold' }}
                            >
                                {part.unit}
                            </span>
                        </span>
                    )}
                </React.Fragment>
            ))}
        </span>
    );
};

export default CurrencyDisplay;
