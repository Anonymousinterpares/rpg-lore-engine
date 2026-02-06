import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './LoadingOverlay.module.css';
const LoadingOverlay = ({ message = 'Loading...' }) => {
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
            }
            else {
                pathData += ` L ${x1} ${y1}`;
            }
            pathData += ` L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4}`;
        }
        return pathData + " Z";
    };
    const gearTeethPath = generateGearPath();
    return (_jsx("div", { className: styles.overlay, children: _jsxs("div", { className: styles.content, children: [_jsx("div", { className: styles.glowRing }), _jsxs("svg", { className: styles.gear, width: "240", height: "240", viewBox: "0 0 100 100", xmlns: "http://www.w3.org/2000/svg", shapeRendering: "crispEdges", children: [_jsxs("defs", { children: [_jsxs("radialGradient", { id: "gearBody", cx: "50%", cy: "45%", r: "60%", children: [_jsx("stop", { offset: "0%", stopColor: "#f0b46f" }), _jsx("stop", { offset: "40%", stopColor: "#d49352" }), _jsx("stop", { offset: "100%", stopColor: "#8a5831" })] }), _jsxs("radialGradient", { id: "gearInner", cx: "40%", cy: "40%", r: "65%", children: [_jsx("stop", { offset: "0%", stopColor: "#f6c88b" }), _jsx("stop", { offset: "40%", stopColor: "#c88a4a" }), _jsx("stop", { offset: "100%", stopColor: "#6b4024" })] })] }), _jsx("path", { d: gearTeethPath, fill: "#8a5831", stroke: "#2b1710", strokeWidth: "1.2" }), _jsx("circle", { cx: "50", cy: "50", r: "35", fill: "url(#gearBody)", stroke: "#2b1710", strokeWidth: "1.2" }), _jsx("circle", { cx: "50", cy: "50", r: "16", fill: "none", stroke: "#2b1710", strokeWidth: "1.2" }), _jsx("circle", { cx: "50", cy: "50", r: "31", fill: "none", stroke: "#f0b46f", strokeWidth: "0.8", opacity: "0.4" }), _jsx("circle", { cx: "50", cy: "50", r: "10", fill: "url(#gearInner)", stroke: "#2b1710", strokeWidth: "1.2" }), _jsx("circle", { cx: "50", cy: "50", r: "5", fill: "#1b0f0b" }), _jsx("path", { d: "M 50 15 A 35 35 0 0 1 85 50", fill: "none", stroke: "#f6c88b", strokeWidth: "1.2", opacity: "0.6" }), _jsx("path", { d: "M 50 66 A 16 16 0 0 1 66 50", fill: "none", stroke: "#f6c88b", strokeWidth: "1.2", opacity: "0.4" }), _jsx("path", { d: "M 15 50 A 35 35 0 0 0 50 85", fill: "none", stroke: "#1b0f0b", strokeWidth: "1.2", opacity: "0.5" })] }), _jsx("h2", { className: styles.loadingText, children: message })] }) }));
};
export default LoadingOverlay;
