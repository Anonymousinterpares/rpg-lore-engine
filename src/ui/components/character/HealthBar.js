import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './HealthBar.module.css';
const HealthBar = ({ current, max, temp = 0 }) => {
    const healthPercent = Math.min((current / max) * 100, 100);
    const tempPercent = Math.min((temp / max) * 100, 100);
    return (_jsxs("div", { className: styles.container, children: [_jsxs("div", { className: styles.barBackground, children: [_jsx("div", { className: styles.healthFill, style: { width: `${healthPercent}%` } }), temp > 0 && (_jsx("div", { className: styles.tempFill, style: { width: `${tempPercent}%`, left: `${healthPercent}%` } }))] }), _jsxs("div", { className: styles.text, children: [current, " / ", max, " ", temp > 0 && `(+${temp})`, " HP"] })] }));
};
export default HealthBar;
