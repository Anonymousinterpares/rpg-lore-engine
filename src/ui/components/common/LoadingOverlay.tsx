import React from 'react';
import styles from './LoadingOverlay.module.css';

interface LoadingOverlayProps {
    message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = 'Loading...' }) => {
    // Generate the complex gear shape mathematically to ensure perfect regularity
    const generateGearPath = () => {
        const teeth = 16;
        const outerRadius = 48;
        const innerRadius = 35;
        const angleStep = (Math.PI * 2) / teeth;

        let pathData = "";

        for (let i = 0; i < teeth; i++) {
            const angle = i * angleStep;

            const x1 = 50 + innerRadius * Math.cos(angle - angleStep * 0.35);
            const y1 = 50 + innerRadius * Math.sin(angle - angleStep * 0.35);

            const x2 = 50 + outerRadius * Math.cos(angle - angleStep * 0.22);
            const y2 = 50 + outerRadius * Math.sin(angle - angleStep * 0.22);

            const x3 = 50 + outerRadius * Math.cos(angle + angleStep * 0.22);
            const y3 = 50 + outerRadius * Math.sin(angle + angleStep * 0.22);

            const x4 = 50 + innerRadius * Math.cos(angle + angleStep * 0.35);
            const y4 = 50 + innerRadius * Math.sin(angle + angleStep * 0.35);

            if (i === 0) {
                pathData += `M ${x1} ${y1}`;
            } else {
                pathData += ` L ${x1} ${y1}`;
            }

            pathData += ` L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4}`;
        }

        return pathData + " Z";
    };

    const gearTeethPath = generateGearPath();

    return (
        <div className={styles.overlay}>
            <div className={styles.content}>
                {/* Decorative glow ring */}
                <div className={styles.glowRing}></div>

                {/* Gear SVG - Fantasy RPG styled */}
                <svg
                    className={styles.gear}
                    width="240"
                    height="240"
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                    shapeRendering="crispEdges"
                >
                    <defs>
                        <radialGradient id="gearBody" cx="50%" cy="45%" r="60%">
                            <stop offset="0%" stopColor="#f0b46f" />
                            <stop offset="40%" stopColor="#d49352" />
                            <stop offset="100%" stopColor="#8a5831" />
                        </radialGradient>
                        <radialGradient id="gearInner" cx="40%" cy="40%" r="65%">
                            <stop offset="0%" stopColor="#f6c88b" />
                            <stop offset="40%" stopColor="#c88a4a" />
                            <stop offset="100%" stopColor="#6b4024" />
                        </radialGradient>
                    </defs>

                    {/* Mathematically calculated involute-style gear teeth */}
                    <path d={gearTeethPath} fill="#8a5831" stroke="#2b1710" strokeWidth="1.2" />

                    {/* Outer ring */}
                    <circle
                        cx="50"
                        cy="50"
                        r="35"
                        fill="url(#gearBody)"
                        stroke="#2b1710"
                        strokeWidth="1.2"
                    />

                    {/* Inner decorative ring */}
                    <circle
                        cx="50"
                        cy="50"
                        r="16"
                        fill="none"
                        stroke="#2b1710"
                        strokeWidth="1.2"
                    />

                    {/* Outer decorative ring for the face */}
                    <circle
                        cx="50"
                        cy="50"
                        r="31"
                        fill="none"
                        stroke="#f0b46f"
                        strokeWidth="0.8"
                        opacity="0.4"
                    />

                    {/* Center hole structure */}
                    <circle cx="50" cy="50" r="10" fill="url(#gearInner)" stroke="#2b1710" strokeWidth="1.2" />
                    <circle cx="50" cy="50" r="5" fill="#1b0f0b" />

                    {/* Highlights following the curvature */}
                    <path d="M 50 15 A 35 35 0 0 1 85 50" fill="none" stroke="#f6c88b" strokeWidth="1.2" opacity="0.6" />
                    <path d="M 50 66 A 16 16 0 0 1 66 50" fill="none" stroke="#f6c88b" strokeWidth="1.2" opacity="0.4" />

                    {/* Darker shadows to emphasize depth */}
                    <path d="M 15 50 A 35 35 0 0 0 50 85" fill="none" stroke="#1b0f0b" strokeWidth="1.2" opacity="0.5" />
                </svg>

                {/* Loading text */}
                <h2 className={styles.loadingText}>{message}</h2>
            </div>
        </div>
    );
};

export default LoadingOverlay;
