import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import glassStyles from '../../styles/glass.module.css';
import styles from './Sidebar.module.css';
import { Package } from 'lucide-react';
import CharacterPanel from '../character/CharacterPanel';
const Sidebar = ({ className }) => {
    return (_jsxs("aside", { className: `${styles.sidebar} ${className}`, children: [_jsx(CharacterPanel, {}), _jsxs("div", { className: glassStyles.panel, children: [_jsxs("div", { className: styles.sectionHeader, children: [_jsx(Package, { size: 18 }), _jsx("h2", { children: "Inventory" })] }), _jsx("div", { className: styles.placeholder, children: "Inventory Grid Placeholder" })] })] }));
};
export default Sidebar;
