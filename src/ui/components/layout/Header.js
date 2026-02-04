import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import parchmentStyles from '../../styles/parchment.module.css';
import styles from './Header.module.css';
import { Shield, Menu, Settings, Users, Book, User, Backpack } from 'lucide-react';
import TimeDisplay from '../exploration/TimeDisplay';
const Header = ({ onLobby, onSettings, onCodex, onCharacter, onEquipment, onMenu }) => {
    return (_jsxs("header", { className: styles.header, children: [_jsxs("div", { className: styles.logo, children: [_jsx(Shield, { className: styles.logoIcon }), _jsx("h1", { children: "RPG Lore Engine" })] }), _jsx("div", { className: styles.timeContainer, children: _jsx(TimeDisplay, {}) }), _jsxs("div", { className: styles.controls, children: [_jsxs("button", { className: parchmentStyles.button, onClick: onLobby, children: [_jsx(Users, { size: 18 }), _jsx("span", { children: "Lobby" })] }), _jsx("button", { className: parchmentStyles.button, onClick: onCharacter, title: "Character Sheet", children: _jsx(User, { size: 18 }) }), _jsx("button", { className: parchmentStyles.button, onClick: onEquipment, title: "Equipment", children: _jsx(Backpack, { size: 18 }) }), _jsx("button", { className: parchmentStyles.button, onClick: onCodex, title: "Codex", children: _jsx(Book, { size: 18 }) }), _jsx("button", { className: parchmentStyles.button, onClick: onSettings, children: _jsx(Settings, { size: 18 }) }), _jsx("button", { className: parchmentStyles.button, onClick: onMenu, children: _jsx(Menu, { size: 18 }) })] })] }));
};
export default Header;
