import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import tip from '../../styles/tooltip.module.css';

interface GameTooltipProps {
    text?: string;
    children: React.ReactNode;
    className?: string;
    offsetY?: number;
}

/** Wraps any element with a styled hover tooltip. Escapes overflow:hidden containers via position:fixed.
 *  Flips to below when the anchor is near the top of the screen, and clamps x to stay within viewport. */
const GameTooltip: React.FC<GameTooltipProps> = ({ text, children, className, offsetY = 0 }) => {
    const [anchor, setAnchor] = useState<{ x: number; y: number; flip: boolean } | null>(null);
    const [displayX, setDisplayX] = useState<number | null>(null);
    const tipRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (anchor && tipRef.current) {
            const w = tipRef.current.offsetWidth;
            const vw = window.innerWidth;
            const raw = anchor.x;
            const clamped = Math.max(w / 2 + 6, Math.min(raw, vw - w / 2 - 6));
            setDisplayX(clamped);
        } else {
            setDisplayX(null);
        }
    }, [anchor]);

    const handleEnter = useCallback((e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const flip = rect.top < 80;
        setAnchor({ x: rect.left + rect.width / 2, y: flip ? rect.bottom : rect.top, flip });
    }, []);

    const handleLeave = useCallback(() => { setAnchor(null); setDisplayX(null); }, []);

    if (!text) return <>{children}</>;
    return (
        <div
            className={`${tip.hoverWrap} ${className || ''}`}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            {children}
            {anchor && (
                <div
                    ref={tipRef}
                    className={tip.hoverTip}
                    style={{
                        left: displayX ?? anchor.x,
                        top: anchor.flip
                            ? anchor.y + 8 + offsetY
                            : anchor.y - 26 + offsetY,
                        transform: anchor.flip ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
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
