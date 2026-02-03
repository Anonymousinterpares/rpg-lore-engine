import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './Sidebar.module.css';
import CharacterPanel from '../character/CharacterPanel';
import InventoryGrid from '../inventory/InventoryGrid';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';
const Sidebar = ({ className }) => {
    const { state } = useGameState();
    const items = state?.character?.inventory?.items || [];
    const gold = state?.character?.inventory?.gold || { gp: 0, sp: 0, cp: 0 };
    return (_jsxs("aside", { className: `${styles.sidebar} ${parchmentStyles.panel} ${className}`, children: [_jsx(CharacterPanel, {}), _jsx(InventoryGrid, { items: items, gold: gold, className: styles.inventoryGrid })] }));
};
export default Sidebar;
