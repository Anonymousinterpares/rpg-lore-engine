import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './Sidebar.module.css';
import CharacterPanel from '../character/CharacterPanel';
import parchmentStyles from '../../styles/parchment.module.css';
const Sidebar = ({ className }) => {
    return (_jsxs("aside", { className: `${styles.sidebar} ${parchmentStyles.panel} ${className}`, children: [_jsx(CharacterPanel, {}), _jsxs("div", { className: styles.inventory, children: [_jsx("h3", { children: "Inventory" }), _jsx("div", { className: styles.placeholder, children: "Items will appear here" })] })] }));
};
export default Sidebar;
