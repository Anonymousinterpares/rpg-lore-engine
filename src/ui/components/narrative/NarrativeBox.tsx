import React, { useState, useEffect, useRef } from 'react';
import styles from './NarrativeBox.module.css';
import parchmentStyles from '../../styles/parchment.module.css';

interface NarrativeBoxProps {
    text: string;
    speed?: number; // ms per character
    title?: string;
    paused?: boolean; // When true, queue new text instead of starting typewriter
    onTypingComplete?: () => void;
    onTypingStart?: () => void;
}

const NarrativeBox: React.FC<NarrativeBoxProps> = ({ text, speed = 20, title, paused = false, onTypingComplete, onTypingStart }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const onTypingCompleteRef = useRef(onTypingComplete);
    onTypingCompleteRef.current = onTypingComplete;
    const onTypingStartRef = useRef(onTypingStart);
    onTypingStartRef.current = onTypingStart;

    // Track what text is queued vs what's actively being typed
    const pendingTextRef = useRef<string | null>(null);
    const typingTextRef = useRef<string | null>(null); // text currently being typed
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isFirstRenderRef = useRef(true); // Skip typewriter on initial mount (loaded save)

    // Start the typewriter for a given text
    const startTypewriter = (targetText: string) => {
        if (!targetText) return;
        // Don't restart if already typing the same text
        if (typingTextRef.current === targetText && timerRef.current !== null) return;
        typingTextRef.current = targetText;

        // Clear any existing timer
        if (timerRef.current) clearInterval(timerRef.current);

        console.log('[NarrativeBox] Starting typewriter, first 50 chars:', JSON.stringify(targetText.substring(0, 50)));
        setDisplayedText('');
        setIsComplete(false);
        onTypingStartRef.current?.();
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
            }
        }, speed);
    };

    // Handle new text arriving
    useEffect(() => {
        if (paused) {
            pendingTextRef.current = text;
            return;
        }

        const targetText = pendingTextRef.current ?? text;
        pendingTextRef.current = null;

        if (!targetText) return;

        // On first render (game load), show text instantly — no typewriter
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            typingTextRef.current = targetText;
            setDisplayedText(targetText);
            setIsComplete(true);
            return;
        }

        startTypewriter(targetText);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, speed, paused]);

    // Cleanup on unmount
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
