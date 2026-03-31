export type ItemType = 'Weapon' | 'Armor' | 'Shield' | 'Adventuring Gear' | 'Tool' | 'Misc' | 'Magic Item' | 'Spell Scroll' | 'Ring' | 'Amulet' | 'Cloak' | 'Belt' | 'Boots' | 'Gloves' | 'Bracers' | 'Helmet' | 'Ammunition';

export interface PaperdollItem {
    id: string;
    instanceId: string;
    name: string;
    type: ItemType;
    weight: number;
    quantity: number;
    equipped: boolean;
    description?: string;
    icon?: string;
    rarity?: 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary';
    // Weapon fields
    damage?: { dice: string; type: string };
    properties?: string[];
    range?: { normal: number; long?: number };
    // Armor fields
    acBonus?: number;
    acCalculated?: string;
    strengthReq?: number;
    stealthDisadvantage?: boolean;
    // Magic
    isMagic?: boolean;
    attunement?: boolean;
    charges?: number;
    // Forge fields
    modifiers?: { type: string; target: string; value: number }[];
    magicalProperties?: { type: string; element?: string; value?: number; dice?: string; spellName?: string; maxCharges?: number; description?: string }[];
    isForged?: boolean;
    forgeSource?: string;
    itemLevel?: number;
    // Identification
    identified?: boolean;
    trueRarity?: string;
    trueName?: string;
    lore?: string;
}

export type SlotId =
    | 'head' | 'neck' | 'shoulders' | 'armor' | 'cloak'
    | 'belt' | 'bracers' | 'gloves' | 'legs' | 'feet'
    | 'mainHand' | 'offHand' | 'ammunition'
    | 'leftRing1' | 'leftRing2' | 'leftRing3' | 'leftRing4' | 'leftRing5'
    | 'rightRing1' | 'rightRing2' | 'rightRing3' | 'rightRing4' | 'rightRing5';

export interface SlotConfig {
    id: SlotId;
    label: string;
    accepts: ItemType[];
    position: { top: string; left: string };
    size?: 'normal' | 'small' | 'large';
}

export interface EquippedSlots {
    [slotId: string]: PaperdollItem | null;
}
