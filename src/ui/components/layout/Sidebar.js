import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './Sidebar.module.css';
import CharacterPanel from '../character/CharacterPanel';
import InventoryGrid from '../inventory/InventoryGrid';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';
const Sidebar = ({ className }) => {
    const { state, engine, updateState } = useGameState();
    const items = state?.character?.inventory?.items || [];
    const gold = state?.character?.inventory?.gold || { gp: 0, sp: 0, cp: 0 };
    // D&D 5e: Carrying Capacity = Strength Score * 15 lbs
    const strScore = state?.character?.stats?.STR || 10;
    const capacity = strScore * 15;
    const handleItemAction = (action, item) => {
        if (!engine)
            return;
        if (action === 'drop') {
            engine.dropItem(item.instanceId);
            updateState();
        }
        else if (action === 'equip') {
            engine.equipItem(item.instanceId);
            updateState();
        }
        else if (action === 'pickup') {
            engine.pickupItem(item.instanceId);
            updateState();
        }
    };
    return (_jsxs("aside", { className: `${styles.sidebar} ${parchmentStyles.panel} ${className}`, children: [_jsx(CharacterPanel, {}), _jsx(InventoryGrid, { items: items, gold: gold, capacity: capacity, droppedItems: state?.location?.droppedItems, maxSlots: 20, onItemAction: handleItemAction, className: styles.inventoryGrid })] }));
};
export default Sidebar;
