import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect } from 'react';
import styles from './CombatLog.module.css';
import terminalStyles from '../../styles/terminal.module.css';
const CombatLog = ({ logs, className = '' }) => {
    const scrollRef = useRef(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);
    const getTypeClass = (type) => {
        switch (type) {
            case 'warning': return terminalStyles.warning;
            case 'error': return terminalStyles.error;
            case 'info': return terminalStyles.info;
            case 'success': return styles.success;
            default: return '';
        }
    };
    return (_jsxs("div", { className: `${styles.container} ${terminalStyles.panel} ${className}`, children: [_jsx("div", { className: styles.header, children: "Combat Log" }), _jsx("div", { className: styles.scrollArea, ref: scrollRef, children: logs.map((log) => (_jsxs("div", { className: `${styles.entry} ${getTypeClass(log.type)}`, children: [log.turn !== undefined && _jsxs("span", { className: styles.turn, children: ["[T", log.turn, "]"] }), _jsx("span", { className: styles.message, children: log.message })] }, log.id))) })] }));
};
export default CombatLog;
