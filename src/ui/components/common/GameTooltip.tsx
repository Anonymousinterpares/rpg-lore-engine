import React, { useState, useRef, useCallback } from 'react';
import tip from '../../styles/tooltip.module.css';

interface GameTooltipProps {
    text?: string;
    children: React.ReactNode;
    className?: string;
}

/** Wraps any element with a styled hover tooltip. Escapes overflow:hidden containers. */
const GameTooltip: React.FC<GameTooltipProps> = ({ text, children, className }) => {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    const handleEnter = useCallback((e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPos({ x: rect.left + rect.width / 2, y: rect.top });
    }, []);

    const handleLeave = useCallback(() => setPos(null), []);

    if (!text) return <>{children}</>;
    return (
        <div
            ref={wrapRef}
            className={`${tip.hoverWrap} ${className || ''}`}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            {children}
            {pos && (
                <div
                    className={tip.hoverTip}
                    style={{
                        left: pos.x,
                        top: pos.y - 6,
                        transform: 'translate(-50%, -100%)',
                        visibility: 'visible',
                        opacity: 1,
                    }}
                >
                    {text}
                </div>
            )}
        </div>
    );
};

export default GameTooltip;
