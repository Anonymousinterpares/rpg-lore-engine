import React from 'react';
import styles from './HandRings.module.css';
import EquipmentSlot from './EquipmentSlot';
import { PaperdollItem, SlotConfig, SlotId } from './types';

interface HandRingsProps {
    hand: 'left' | 'right';
    sex: 'male' | 'female';
    equippedSlots: Record<string, PaperdollItem | null>;
    onDrop: (slotId: string, item: PaperdollItem) => void;
    onUnequip: (slotId: string) => void;
}

const FINGER_LABELS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

const HandRings: React.FC<HandRingsProps> = ({ hand, sex, equippedSlots, onDrop, onUnequip }) => {
    const slotConfigs: SlotConfig[] = FINGER_LABELS.map((finger, i) => ({
        id: `${hand}Ring${i + 1}` as SlotId,
        label: `${finger}`,
        accepts: ['Ring'] as any[],
        position: { top: '0', left: '0' },
        size: 'small',
    }));

    return (
        <div className={`${styles.handContainer} ${styles[hand]}`}>
            <img
                src={`/assets/paperdoll/hand_${hand}_${sex}.png`}
                alt=""
                className={styles.handBg}
                draggable={false}
            />
            <div className={styles.handLabel}>{hand === 'left' ? 'Left Hand' : 'Right Hand'}</div>
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
