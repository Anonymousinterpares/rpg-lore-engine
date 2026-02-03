import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import glassStyles from '../../styles/glass.module.css';
import styles from './Header.module.css';
import { Shield, Menu, Settings, Users } from 'lucide-react';
const Header = () => {
    return (_jsxs("header", { className: styles.header, children: [_jsxs("div", { className: styles.logo, children: [_jsx(Shield, { className: styles.logoIcon }), _jsx("h1", { children: "RPG Lore Engine" })] }), _jsxs("div", { className: styles.controls, children: [_jsxs("button", { className: glassStyles.button, children: [_jsx(Users, { size: 18 }), _jsx("span", { children: "Lobby" })] }), _jsx("button", { className: glassStyles.button, children: _jsx(Settings, { size: 18 }) }), _jsx("button", { className: glassStyles.button, children: _jsx(Menu, { size: 18 }) })] })] }));
};
export default Header;
