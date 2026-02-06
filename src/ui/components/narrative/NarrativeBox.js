import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import styles from './NarrativeBox.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
const NarrativeBox = ({ text, speed = 20, title }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const scrollRef = useRef(null);
    useEffect(() => {
        console.log('[NarrativeBox] Text received, first 50 chars:', JSON.stringify(text.substring(0, 50)));
        console.log('[NarrativeBox] First char code:', text.charCodeAt(0));
        setDisplayedText('');
        setIsComplete(false);
        let index = 0;
        const timer = setInterval(() => {
            if (index < text.length) {
                // CRITICAL: Capture the character BEFORE incrementing index
                // This prevents the closure from reading the wrong index value
                const currentChar = text.charAt(index);
                setDisplayedText((prev) => prev + currentChar);
                index++;
                // Auto-scroll to bottom
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }
            else {
                setIsComplete(true);
                clearInterval(timer);
            }
        }, speed);
        return () => clearInterval(timer);
    }, [text, speed]);
    return (_jsxs("div", { className: `${parchmentStyles.panel} ${styles.narrativeBox}`, ref: scrollRef, children: [title && _jsx("h2", { className: parchmentStyles.heading, children: title }), _jsxs("div", { className: parchmentStyles.text, children: [displayedText, !isComplete && _jsx("span", { className: styles.cursor, children: "|" })] })] }));
};
export default NarrativeBox;
