import React from 'react';
import styles from './HandRings.module.css';
import EquipmentSlot from './EquipmentSlot';
import { PaperdollItem, SlotConfig, SlotId } from './types';

interface HandRingsProps {
    hand: 'left' | 'right';
    equippedSlots: Record<string, PaperdollItem | null>;
    onDrop: (slotId: string, item: PaperdollItem) => void;
    onUnequip: (slotId: string) => void;
}

const FINGER_LABELS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

const HandRings: React.FC<HandRingsProps> = ({ hand, equippedSlots, onDrop, onUnequip }) => {
    const slotConfigs: SlotConfig[] = FINGER_LABELS.map((finger, i) => ({
        id: `${hand}Ring${i + 1}` as SlotId,
        label: `${finger}`,
        accepts: ['Ring'] as any[],
        position: { top: '0', left: '0' },
        size: 'small',
    }));

    return (
        <div className={`${styles.handContainer} ${styles[hand]}`}>
            <div className={styles.handLabel}>{hand === 'left' ? 'Left Hand' : 'Right Hand'}</div>
            <div className={styles.handSvg}>
                {/* Stylized hand outline */}
                <svg viewBox="0 0 100 130" className={styles.handOutline}>
                    <path
                        d={hand === 'left'
                            ? 'M50,125 L20,125 Q5,125 5,110 L5,70 Q5,60 15,55 L15,25 Q15,10 25,10 Q35,10 35,25 L35,45 L35,20 Q35,5 45,5 Q55,5 55,20 L55,40 L55,15 Q55,0 65,0 Q75,0 75,15 L75,45 L75,25 Q75,12 83,12 Q91,12 91,25 L91,80 Q91,110 70,120 L50,125 Z'
                            : 'M50,125 L80,125 Q95,125 95,110 L95,70 Q95,60 85,55 L85,25 Q85,10 75,10 Q65,10 65,25 L65,45 L65,20 Q65,5 55,5 Q45,5 45,20 L45,40 L45,15 Q45,0 35,0 Q25,0 25,15 L25,45 L25,25 Q25,12 17,12 Q9,12 9,25 L9,80 Q9,110 30,120 L50,125 Z'
                        }
                        fill="none"
                        stroke="#5d4037"
                        strokeWidth="1.5"
                        opacity="0.4"
                    />
                </svg>
            </div>
            <div className={styles.ringSlots}>
                {slotConfigs.map((slotConfig, i) => (
                    <div key={slotConfig.id} className={styles.ringSlotWrapper} title={FINGER_LABELS[i]}>
                        <EquipmentSlot
                            config={slotConfig}
                            item={equippedSlots[slotConfig.id] || null}
                            onDrop={onDrop}
                            onUnequip={onUnequip}
                            isRingSlot
                        />
                        <span className={styles.fingerLabel}>{FINGER_LABELS[i][0]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HandRings;
