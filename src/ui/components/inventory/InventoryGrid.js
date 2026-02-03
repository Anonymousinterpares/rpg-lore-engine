import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './InventoryGrid.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Package, Sword, Shield, FlaskConical, Scroll, Coins } from 'lucide-react';
const InventoryGrid = ({ items, gold, onItemClick, className = '' }) => {
    const getItemIcon = (type) => {
        const t = type.toLowerCase();
        if (t.includes('weapon'))
            return _jsx(Sword, { size: 18 });
        if (t.includes('armor') || t.includes('shield'))
            return _jsx(Shield, { size: 18 });
        if (t.includes('potion'))
            return _jsx(FlaskConical, { size: 18 });
        if (t.includes('scroll'))
            return _jsx(Scroll, { size: 18 });
        return _jsx(Package, { size: 18 });
    };
    return (_jsxs("div", { className: `${styles.container} ${parchmentStyles.panel} ${className}`, children: [_jsxs("div", { className: styles.header, children: [_jsx("h3", { className: parchmentStyles.heading, children: "Inventory" }), _jsxs("div", { className: styles.gold, children: [_jsx(Coins, { size: 14, className: styles.goldIcon }), _jsxs("span", { children: [gold.gp, "g ", gold.sp, "s ", gold.cp, "c"] })] })] }), _jsxs("div", { className: styles.grid, children: [items.map((item) => (_jsxs("div", { className: `${styles.itemSlot} ${item.equipped ? styles.equipped : ''}`, onClick: () => onItemClick?.(item), title: `${item.name} (${item.type})`, children: [_jsx("div", { className: styles.iconWrapper, children: getItemIcon(item.type) }), item.quantity > 1 && _jsx("span", { className: styles.quantity, children: item.quantity }), item.equipped && _jsx("div", { className: styles.equippedBadge, children: "E" })] }, item.id))), [...Array(Math.max(0, 20 - items.length))].map((_, i) => (_jsx("div", { className: styles.emptySlot }, `empty-${i}`)))] })] }));
};
export default InventoryGrid;
