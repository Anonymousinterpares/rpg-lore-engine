import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './DiceRoller.module.css';
import { Dices } from 'lucide-react';
const DiceRoller = ({ result, sides = 20, isRolling = false, className = '' }) => {
    const [displayValue, setDisplayValue] = useState(result || sides);
    useEffect(() => {
        let interval;
        if (isRolling) {
            interval = setInterval(() => {
                setDisplayValue(Math.floor(Math.random() * sides) + 1);
            }, 50);
        }
        else {
            setDisplayValue(result || displayValue);
        }
        return () => clearInterval(interval);
    }, [isRolling, result, sides, displayValue]);
    return (_jsxs("div", { className: `${styles.container} ${className}`, children: [_jsxs("div", { className: `${styles.die} ${isRolling ? styles.rolling : ''}`, children: [_jsx(Dices, { size: 24, className: styles.icon }), _jsx("span", { className: styles.value, children: displayValue })] }), _jsxs("div", { className: styles.label, children: ["D", sides] })] }));
};
export default DiceRoller;
