import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import styles from './TurnBanner.module.css';
const TurnBanner = ({ playerName, isPlayerTurn, className = '' }) => {
    const [show, setShow] = useState(false);
    useEffect(() => {
        if (isPlayerTurn) {
            setShow(true);
            const timer = setTimeout(() => setShow(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isPlayerTurn]);
    if (!show)
        return null;
    return (_jsx("div", { className: `${styles.banner} ${className}`, children: _jsxs("div", { className: styles.content, children: [_jsx("span", { className: styles.label, children: "YOUR TURN" }), _jsx("h2", { className: styles.name, children: playerName })] }) }));
};
export default TurnBanner;
