import React from 'react';
import styles from './PaperdollFigure.module.css';
import EquipmentSlot from './EquipmentSlot';
import HandRings from './HandRings';
import { PaperdollItem, SlotConfig, SlotId, EquippedSlots } from './types';

interface PaperdollFigureProps {
    equippedSlots: EquippedSlots;
    onDrop: (slotId: string, item: PaperdollItem) => void;
    onUnequip: (slotId: string) => void;
}

// Slot positions are percentages relative to the figure container.
// Easy to adjust when the real silhouette image arrives.
const SLOT_CONFIGS: SlotConfig[] = [
    { id: 'head',       label: 'Head',       accepts: ['Helmet', 'Armor'],                    position: { top: '2%',  left: '50%' } },
    { id: 'neck',       label: 'Amulet',     accepts: ['Amulet', 'Magic Item'],               position: { top: '12%', left: '50%' } },
    { id: 'shoulders',  label: 'Shoulders',  accepts: ['Armor', 'Magic Item'],                position: { top: '15%', left: '18%' } },
    { id: 'cloak',      label: 'Cloak',      accepts: ['Cloak', 'Magic Item'],                position: { top: '15%', left: '82%' } },
    { id: 'armor',      label: 'Armor',      accepts: ['Armor'],                              position: { top: '26%', left: '50%' }, size: 'large' },
    { id: 'bracers',    label: 'Bracers',    accepts: ['Bracers', 'Magic Item'],              position: { top: '32%', left: '14%' } },
    { id: 'gloves',     label: 'Gloves',     accepts: ['Gloves', 'Magic Item'],               position: { top: '32%', left: '86%' } },
    { id: 'belt',       label: 'Belt',       accepts: ['Belt', 'Magic Item'],                 position: { top: '42%', left: '50%' } },
    { id: 'mainHand',   label: 'Main Hand',  accepts: ['Weapon'],                             position: { top: '48%', left: '10%' }, size: 'large' },
    { id: 'offHand',    label: 'Off Hand',   accepts: ['Weapon', 'Shield'],                   position: { top: '48%', left: '90%' }, size: 'large' },
    { id: 'legs',       label: 'Legs',       accepts: ['Armor', 'Magic Item'],                position: { top: '60%', left: '50%' } },
    { id: 'feet',       label: 'Boots',      accepts: ['Boots', 'Magic Item'],                position: { top: '80%', left: '50%' } },
    { id: 'ammunition', label: 'Ammo',       accepts: ['Ammunition', 'Adventuring Gear'],     position: { top: '8%',  left: '18%' } },
];

const PaperdollFigure: React.FC<PaperdollFigureProps> = ({ equippedSlots, onDrop, onUnequip }) => {
    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Equipment</h3>

            <div className={styles.figureArea}>
                {/* Placeholder silhouette — will be replaced with user's image */}
                <div className={styles.silhouette}>
                    <svg viewBox="0 0 200 500" className={styles.silhouetteSvg}>
                        {/* Head */}
                        <ellipse cx="100" cy="45" rx="28" ry="32" />
                        {/* Neck */}
                        <rect x="90" y="75" width="20" height="15" rx="4" />
                        {/* Torso */}
                        <path d="M60,90 Q55,90 50,100 L40,180 Q38,190 45,195 L80,200 L120,200 L155,195 Q162,190 160,180 L150,100 Q145,90 140,90 Z" />
                        {/* Left arm */}
                        <path d="M50,100 Q35,105 25,140 L20,200 Q18,210 25,215 L35,215 Q42,210 40,200 L45,150 Q48,130 50,120" />
                        {/* Right arm */}
                        <path d="M150,100 Q165,105 175,140 L180,200 Q182,210 175,215 L165,215 Q158,210 160,200 L155,150 Q152,130 150,120" />
                        {/* Waist/Belt area */}
                        <rect x="45" y="195" width="110" height="15" rx="3" />
                        {/* Left leg */}
                        <path d="M60,210 L55,320 Q54,340 50,370 L45,430 Q43,445 50,450 L75,450 Q82,445 80,435 L70,370 Q68,340 70,320 L80,210" />
                        {/* Right leg */}
                        <path d="M120,210 L125,320 Q126,340 130,370 L135,430 Q137,445 130,450 L105,450 Q98,445 100,435 L110,370 Q112,340 110,320 L100,210" />
                    </svg>
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
                    equippedSlots={equippedSlots}
                    onDrop={onDrop}
                    onUnequip={onUnequip}
                />
                <HandRings
                    hand="right"
                    equippedSlots={equippedSlots}
                    onDrop={onDrop}
                    onUnequip={onUnequip}
                />
            </div>
        </div>
    );
};

export default PaperdollFigure;
