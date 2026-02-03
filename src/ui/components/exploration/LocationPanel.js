import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './LocationPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { MapPin, Info, Trees, Mountain, Waves, Landmark } from 'lucide-react';
const LocationPanel = ({ name, biome, description, interestPoints, className = '' }) => {
    const getBiomeIcon = (biome) => {
        switch (biome.toLowerCase()) {
            case 'forest': return _jsx(Trees, { size: 16 });
            case 'mountains': return _jsx(Mountain, { size: 16 });
            case 'ocean':
            case 'coast': return _jsx(Waves, { size: 16 });
            case 'plains': return _jsx(Trees, { size: 16 }); // Use trees for now
            default: return _jsx(MapPin, { size: 16 });
        }
    };
    return (_jsxs("div", { className: `${parchmentStyles.panel} ${styles.panel} ${className}`, children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.biomeBadge, children: [getBiomeIcon(biome), _jsx("span", { children: biome })] }), _jsx("h3", { className: styles.title, children: name })] }), _jsxs("div", { className: styles.content, children: [_jsx("p", { className: styles.description, children: description }), interestPoints.length > 0 && (_jsxs("div", { className: styles.poiSection, children: [_jsxs("div", { className: styles.sectionTitle, children: [_jsx(Landmark, { size: 14 }), _jsx("span", { children: "Points of Interest" })] }), _jsx("div", { className: styles.poiList, children: interestPoints.map(poi => (_jsxs("div", { className: styles.poiItem, children: [_jsx(Info, { size: 12 }), _jsxs("span", { children: [poi.name, " (", poi.type, ")"] })] }, poi.id))) })] }))] })] }));
};
export default LocationPanel;
