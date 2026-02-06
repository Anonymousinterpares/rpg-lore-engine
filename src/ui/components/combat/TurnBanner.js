import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './TurnBanner.module.css';
const TurnBanner = ({ isPlayerTurn, turnNumber }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        if (isPlayerTurn) {
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isPlayerTurn, turnNumber]);
    if (!visible)
        return null;
    return (_jsx("div", { className: styles.overlay, children: _jsxs("div", { className: styles.banner, children: [_jsx("div", { className: styles.line }), _jsx("h2", { className: styles.text, children: "YOUR TURN" }), _jsx("div", { className: styles.line })] }) }));
};
export default TurnBanner;
