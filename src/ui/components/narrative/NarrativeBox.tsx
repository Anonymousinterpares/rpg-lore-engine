import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import styles from './NarrativeBox.module.css';
import parchmentStyles from '../../styles/parchment.module.css';

interface NarrativeBoxProps {
    text: string;
    speed?: number; // ms per character
    title?: string;
    paused?: boolean;
    instantMode?: boolean; // Show all text instantly (no typewriter)
    onTypingComplete?: () => void;
    onTypingStart?: () => void;
    onSkipAvailable?: (skipFn: (() => void) | null) => void; // Exposes skip function when typing
}

const NarrativeBox: React.FC<NarrativeBoxProps> = ({ text, speed = 20, title, paused = false, instantMode = false, onTypingComplete, onTypingStart, onSkipAvailable }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const onTypingCompleteRef = useRef(onTypingComplete);
    onTypingCompleteRef.current = onTypingComplete;
    const onTypingStartRef = useRef(onTypingStart);
    onTypingStartRef.current = onTypingStart;
    const onSkipAvailableRef = useRef(onSkipAvailable);
    onSkipAvailableRef.current = onSkipAvailable;

    const pendingTextRef = useRef<string | null>(null);
    const typingTextRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const fullTextRef = useRef<string>(''); // Store full text for skip-to-end
    const isFirstRenderRef = useRef(true);

    const finishInstantly = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        if (fullTextRef.current) {
            setDisplayedText(fullTextRef.current);
            setIsComplete(true);
            typingTextRef.current = null;
            onTypingCompleteRef.current?.();
            onSkipAvailableRef.current?.(null);
        }
    }, []);

    const startTypewriter = (targetText: string) => {
        if (!targetText) return;
        if (typingTextRef.current === targetText && timerRef.current !== null) return;
        typingTextRef.current = targetText;
        fullTextRef.current = targetText;

        if (timerRef.current) clearInterval(timerRef.current);

        // Instant mode: show all text immediately
        if (instantMode) {
            setDisplayedText(targetText);
            setIsComplete(true);
            onTypingStartRef.current?.();
            typingTextRef.current = null;
            // Brief delay so onTypingStart fires before onTypingComplete
            setTimeout(() => onTypingCompleteRef.current?.(), 50);
            return;
        }

        setDisplayedText('');
        setIsComplete(false);
        onTypingStartRef.current?.();
        onSkipAvailableRef.current?.(finishInstantly);
        let index = 0;

        timerRef.current = setInterval(() => {
            if (index < targetText.length) {
                const currentChar = targetText.charAt(index);
                setDisplayedText((prev) => prev + currentChar);
                index++;
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            } else {
                setIsComplete(true);
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
                typingTextRef.current = null;
                onTypingCompleteRef.current?.();
                onSkipAvailableRef.current?.(null);
            }
        }, speed);
    };

    useEffect(() => {
        if (paused) {
            pendingTextRef.current = text;
            return;
        }

        const targetText = pendingTextRef.current ?? text;
        pendingTextRef.current = null;

        if (!targetText) return;

        // On first render (game load), show text instantly
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            typingTextRef.current = targetText;
            fullTextRef.current = targetText;
            setDisplayedText(targetText);
            setIsComplete(true);
            return;
        }

        startTypewriter(targetText);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, speed, paused, instantMode]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return (
        <div className={`${parchmentStyles.panel} ${styles.narrativeBox}`} ref={scrollRef}>
            {title && <h2 className={parchmentStyles.heading}>{title}</h2>}
            <div className={parchmentStyles.text}>
                {displayedText}
                {!isComplete && <span className={styles.cursor}>|</span>}
            </div>
        </div>
    );
};

export default NarrativeBox;
