import React, { useState, useEffect, useRef } from 'react';
import styles from './NarrativeBox.module.css';
import parchmentStyles from '../../styles/parchment.module.css';

interface NarrativeBoxProps {
    text: string;
    speed?: number; // ms per character
    title?: string;
}

const NarrativeBox: React.FC<NarrativeBoxProps> = ({ text, speed = 20, title }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setDisplayedText('');
        setIsComplete(false);
        let index = 0;

        const timer = setInterval(() => {
            if (index < text.length) {
                setDisplayedText((prev) => prev + text.charAt(index));
                index++;

                // Auto-scroll to bottom
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            } else {
                setIsComplete(true);
                clearInterval(timer);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [text, speed]);

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
