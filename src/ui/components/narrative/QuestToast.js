import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import styles from './QuestToast.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
const QuestToast = ({ title, type, duration = 5000, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onClose)
                onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);
    if (!isVisible)
        return null;
    const getTypeLabel = () => {
        switch (type) {
            case 'NEW': return 'NEW QUEST';
            case 'UPDATE': return 'QUEST UPDATE';
            case 'COMPLETE': return 'QUEST COMPLETE';
            case 'FAIL': return 'QUEST FAILED';
            default: return 'QUEST';
        }
    };
    const getTypeClass = () => {
        switch (type) {
            case 'COMPLETE': return styles.complete;
            case 'FAIL': return styles.fail;
            case 'UPDATE': return styles.update;
            default: return styles.new;
        }
    };
    return (_jsx("div", { className: `${styles.toast} ${parchmentStyles.panel} ${getTypeClass()}`, children: _jsxs("div", { className: styles.content, children: [_jsx("span", { className: styles.label, children: getTypeLabel() }), _jsx("h4", { className: styles.title, children: title })] }) }));
};
export default QuestToast;
