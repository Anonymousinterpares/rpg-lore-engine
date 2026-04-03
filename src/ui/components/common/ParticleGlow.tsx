import React, { useRef, useEffect } from 'react';

interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;
}

interface ParticleGlowProps {
    glowColor?: string;
    glowRGB?: string;
    particleColor?: string;
    glowRange?: number;
    particleRange?: number;
    pulseSpeed?: number;
    particleSpeed?: number;
    active?: boolean;
    borderRadius?: number;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: (e: React.MouseEvent) => void;
}

const ParticleGlow: React.FC<ParticleGlowProps> = ({
    glowColor = '#2563eb',
    glowRGB = '37, 99, 235',
    particleColor = 'rgba(255, 215, 0, ',
    glowRange = 6,
    particleRange = 6,
    pulseSpeed = 2,
    particleSpeed = 1,
    active = true,
    borderRadius = 4,
    children, className, style, onClick,
}) => {
    const wrapRef = useRef<HTMLDivElement>(null);

    // Store props in refs so the effect doesn't re-run when they change
    const propsRef = useRef({ particleRange, glowRange, particleSpeed, particleColor });
    propsRef.current = { particleRange, glowRange, particleSpeed, particleColor };

    useEffect(() => {
        if (!active || !wrapRef.current) return;

        const wrap = wrapRef.current;
        const pts: Particle[] = [];

        // Create canvas on body — escapes all transform/overflow contexts
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '2147483647';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d')!;
        let w = 0, h = 0;
        let animId = 0;
        let frame = 0;

        function sync() {
            const rect = wrap.getBoundingClientRect();
            const p = Math.max(propsRef.current.particleRange, propsRef.current.glowRange) + 4;
            w = rect.width; h = rect.height;
            canvas.width = w + p * 2;
            canvas.height = h + p * 2;
            canvas.style.top = (rect.top - p) + 'px';
            canvas.style.left = (rect.left - p) + 'px';
        }

        function spawn() {
            if (w === 0 || h === 0) return;
            const { particleSpeed: spd, particleRange: pr, glowRange: gr } = propsRef.current;
            const p = Math.max(pr, gr) + 4;
            const perim = 2 * (w + h);
            const r = Math.random() * perim;
            let x: number, y: number, vx: number, vy: number;

            if (r < w) {
                x = r + p; y = p;
                vx = (Math.random() - 0.5) * 0.4 * spd;
                vy = -(Math.random() * 0.6 + 0.2) * spd;
            } else if (r < w + h) {
                x = w + p; y = (r - w) + p;
                vx = (Math.random() * 0.6 + 0.2) * spd;
                vy = (Math.random() - 0.5) * 0.4 * spd;
            } else if (r < 2 * w + h) {
                x = (r - w - h) + p; y = h + p;
                vx = (Math.random() - 0.5) * 0.4 * spd;
                vy = (Math.random() * 0.6 + 0.2) * spd;
            } else {
                x = p; y = (r - 2 * w - h) + p;
                vx = -(Math.random() * 0.6 + 0.2) * spd;
                vy = (Math.random() - 0.5) * 0.4 * spd;
            }

            const lifeMult = spd < 1 ? 1 / spd : 1;
            pts.push({ x, y, vx, vy, life: (40 + Math.random() * 30) * lifeMult, maxLife: (40 + Math.random() * 30) * lifeMult, size: 1.5 + Math.random() * 1.5 });
        }

        function loop() {
            sync();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            frame++;
            if (frame % 3 === 0) spawn();

            const pc = propsRef.current.particleColor;
            for (let i = pts.length - 1; i >= 0; i--) {
                const pt = pts[i];
                pt.x += pt.vx;
                pt.y += pt.vy;
                pt.life--;
                if (pt.life <= 0) { pts.splice(i, 1); continue; }

                const ratio = pt.life / pt.maxLife;
                const sz = 1 + (pt.size - 1) * ratio;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, sz, 0, Math.PI * 2);
                ctx.fillStyle = pc + (ratio * 0.8).toFixed(2) + ')';
                ctx.fill();
            }

            animId = requestAnimationFrame(loop);
        }

        sync();
        animId = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(animId);
            if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        };
    }, [active]); // Only re-run when active toggles

    if (!active) {
        return <div className={className} style={style} onClick={onClick}>{children}</div>;
    }

    const staticGlow = `0 0 ${glowRange * 0.7}px ${glowRange * 0.4}px rgba(${glowRGB}, 0.45)`;
    const animName = `pgp_${Math.random().toString(36).slice(2, 6)}`;

    return (
        <div
            ref={wrapRef}
            className={className}
            onClick={onClick}
            style={{
                ...style,
                position: 'relative',
                borderColor: glowColor,
                borderRadius,
                color: '#ffd700',
                boxShadow: pulseSpeed === 0 ? staticGlow : undefined,
                animation: pulseSpeed > 0 ? `${animName} ${pulseSpeed}s ease-in-out infinite` : undefined,
            }}
        >
            {pulseSpeed > 0 && (
                <style>{`
                    @keyframes ${animName} {
                        0%, 100% { box-shadow: 0 0 ${glowRange * 0.5}px ${glowRange * 0.3}px rgba(${glowRGB}, 0.3); }
                        50% { box-shadow: 0 0 ${glowRange}px ${glowRange * 0.6}px rgba(${glowRGB}, 0.6); }
                    }
                `}</style>
            )}
            {children}
        </div>
    );
};

export default ParticleGlow;
