import React from 'react';
import styles from './PaperdollFigure.module.css';
import EquipmentSlot from './EquipmentSlot';
import HandRings from './HandRings';
import { PaperdollItem, SlotConfig, SlotId, EquippedSlots } from './types';

interface PaperdollFigureProps {
    equippedSlots: EquippedSlots;
    sex: 'male' | 'female';
    onDrop: (slotId: string, item: PaperdollItem) => void;
    onUnequip: (slotId: string) => void;
}

// Slot positions are percentages relative to the figure container.
// Easy to adjust when the real silhouette image arrives.
const SLOT_CONFIGS: SlotConfig[] = [
    { id: 'head',       label: 'Head',       accepts: ['Helmet', 'Armor'],                    position: { top: '6%',  left: '50%' } },
    { id: 'ammunition', label: 'Ammo',       accepts: ['Ammunition', 'Adventuring Gear'],     position: { top: '6%',  left: '84%' } },
    { id: 'neck',       label: 'Amulet',     accepts: ['Amulet', 'Magic Item'],               position: { top: '15%', left: '50%' } },
    { id: 'shoulders',  label: 'Shoulders',  accepts: ['Armor', 'Magic Item'],                position: { top: '20%', left: '16%' } },
    { id: 'cloak',      label: 'Cloak',      accepts: ['Cloak', 'Magic Item'],                position: { top: '20%', left: '84%' } },
    { id: 'armor',      label: 'Armor',      accepts: ['Armor'],                              position: { top: '30%', left: '50%' }, size: 'large' },
    { id: 'bracers',    label: 'Bracers',    accepts: ['Bracers', 'Magic Item'],              position: { top: '36%', left: '12%' } },
    { id: 'gloves',     label: 'Gloves',     accepts: ['Gloves', 'Magic Item'],               position: { top: '36%', left: '88%' } },
    { id: 'belt',       label: 'Belt',       accepts: ['Belt', 'Magic Item'],                 position: { top: '44%', left: '50%' } },
    { id: 'mainHand',   label: 'Main Hand',  accepts: ['Weapon'],                             position: { top: '50%', left: '8%' }, size: 'large' },
    { id: 'offHand',    label: 'Off Hand',   accepts: ['Weapon', 'Shield'],                   position: { top: '50%', left: '92%' }, size: 'large' },
    { id: 'legs',       label: 'Legs',       accepts: ['Armor', 'Magic Item'],                position: { top: '62%', left: '50%' } },
    { id: 'feet',       label: 'Boots',      accepts: ['Boots', 'Magic Item'],                position: { top: '82%', left: '50%' } },
];

const PaperdollFigure: React.FC<PaperdollFigureProps> = ({ equippedSlots, sex, onDrop, onUnequip }) => {
    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Equipment</h3>

            <div className={styles.figureArea}>
                {/* Character figure image */}
                <div className={styles.silhouette}>
                    <img
                        src={`/assets/paperdoll/default_${sex}.png`}
                        alt=""
                        className={styles.figureImage}
                        draggable={false}
                    />
                </div>

                {/* Equipment slots positioned around the silhouette */}
                {SLOT_CONFIGS.map((config) => (
                    <div
                        key={config.id}
                        className={styles.slotPositioner}
                        style={{
                            top: config.position.top,
                            left: config.position.left,
                        }}
                    >
                        <EquipmentSlot
                            config={config}
                            item={equippedSlots[config.id] || null}
                            onDrop={onDrop}
                            onUnequip={onUnequip}
                        />
                    </div>
                ))}
            </div>

            {/* Ring slots - two hands at the bottom */}
            <div className={styles.handsRow}>
                <HandRings
                    hand="left"
                    sex={sex}
                    equippedSlots={equippedSlots}
                    onDrop={onDrop}
                    onUnequip={onUnequip}
                />
                <HandRings
                    hand="right"
                    sex={sex}
                    equippedSlots={equippedSlots}
                    onDrop={onDrop}
                    onUnequip={onUnequip}
                />
            </div>
        </div>
    );
};

export default PaperdollFigure;
