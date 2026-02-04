import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './CharacterSheet.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { X, Shield, Zap, Heart, Footprints, CheckCircle2 as Check } from 'lucide-react';
import { useGameState } from '../../hooks/useGameState';
const SKILLS = [
    { name: 'Acrobatics', ability: 'DEX' },
    { name: 'Animal Handling', ability: 'WIS' },
    { name: 'Arcana', ability: 'INT' },
    { name: 'Athletics', ability: 'STR' },
    { name: 'Deception', ability: 'CHA' },
    { name: 'History', ability: 'INT' },
    { name: 'Insight', ability: 'WIS' },
    { name: 'Intimidation', ability: 'CHA' },
    { name: 'Investigation', ability: 'INT' },
    { name: 'Medicine', ability: 'WIS' },
    { name: 'Nature', ability: 'INT' },
    { name: 'Perception', ability: 'WIS' },
    { name: 'Performance', ability: 'CHA' },
    { name: 'Persuasion', ability: 'CHA' },
    { name: 'Religion', ability: 'INT' },
    { name: 'Sleight of Hand', ability: 'DEX' },
    { name: 'Stealth', ability: 'DEX' },
    { name: 'Survival', ability: 'WIS' },
];
const CharacterSheet = ({ onClose }) => {
    const { state } = useGameState();
    if (!state || !state.character)
        return null;
    const char = state.character;
    const stats = char.stats;
    const bio = char.biography;
    const profBonus = Math.floor((char.level - 1) / 4) + 2;
    const getMod = (score) => Math.floor((score - 10) / 2);
    const formatMod = (mod) => (mod >= 0 ? `+${mod}` : mod.toString());
    return (_jsx("div", { className: styles.overlay, onClick: onClose, children: _jsxs("div", { className: `${parchmentStyles.panel} ${styles.modal} ${parchmentStyles.overflowVisible}`, onClick: e => e.stopPropagation(), children: [_jsx("button", { className: styles.closeBtn, onClick: onClose, children: _jsx(X, { size: 28 }) }), _jsxs("header", { className: styles.header, children: [_jsx("h1", { className: styles.name, children: char.name }), _jsxs("div", { className: styles.subHeader, children: ["Level ", char.level, " ", char.race, " ", char.class, " \u2022 ", bio.background || 'Unknown Background'] })] }), _jsxs("div", { className: styles.content, children: [_jsxs("aside", { className: styles.leftCol, children: [_jsxs("section", { className: styles.section, children: [_jsx("h2", { className: styles.sectionTitle, children: "Abilities" }), _jsx("div", { className: styles.abilityGrid, children: Object.entries(stats).map(([name, score]) => {
                                                const val = Number(score);
                                                return (_jsxs("div", { className: styles.abilityRow, children: [_jsx("span", { className: styles.statName, children: name }), _jsx("span", { className: styles.statScore, children: val }), _jsx("span", { className: styles.statMod, children: formatMod(getMod(val)) })] }, name));
                                            }) })] }), _jsxs("section", { className: styles.section, children: [_jsx("h2", { className: styles.sectionTitle, children: "Saving Throws" }), _jsx("div", { className: styles.skillGrid, children: Object.entries(stats).map(([name, score]) => {
                                                const isProf = char.savingThrowProficiencies?.includes(name);
                                                const mod = getMod(Number(score)) + (isProf ? profBonus : 0);
                                                return (_jsxs("div", { className: styles.skillRow, children: [_jsxs("div", { className: styles.skillInfo, children: [_jsx("div", { className: styles.profMarker, children: isProf ? _jsx(Check, { size: 14 }) : _jsx("div", { style: { width: 14 } }) }), _jsx("span", { children: name })] }), _jsx("span", { className: styles.skillBonus, children: formatMod(mod) })] }, name));
                                            }) })] }), _jsxs("section", { className: styles.section, children: [_jsx("h2", { className: styles.sectionTitle, children: "Skills" }), _jsx("div", { className: styles.skillGrid, children: SKILLS.map(skill => {
                                                const isProf = char.skillProficiencies?.includes(skill.name);
                                                const abilityScore = stats[skill.ability] || 10;
                                                const mod = getMod(abilityScore) + (isProf ? profBonus : 0);
                                                return (_jsxs("div", { className: styles.skillRow, children: [_jsxs("div", { className: styles.skillInfo, children: [_jsx("div", { className: styles.profMarker, children: isProf ? _jsx(Check, { size: 14 }) : _jsx("div", { style: { width: 14 } }) }), _jsxs("span", { children: [skill.name, " ", _jsxs("small", { style: { opacity: 0.5 }, children: ["(", skill.ability.toLowerCase(), ")"] })] })] }), _jsx("span", { className: styles.skillBonus, children: formatMod(mod) })] }, skill.name));
                                            }) })] })] }), _jsxs("main", { className: styles.rightCol, children: [_jsxs("div", { className: styles.combatMetrics, children: [_jsxs("div", { className: styles.metricBox, children: [_jsx("div", { className: styles.metricValue, children: char.ac }), _jsx("div", { className: styles.metricLabel, children: "Armor Class" }), _jsx(Shield, { size: 20, style: { marginTop: 8, opacity: 0.3 } })] }), _jsxs("div", { className: styles.metricBox, children: [_jsx("div", { className: styles.metricValue, children: formatMod(getMod(stats.DEX || 10)) }), _jsx("div", { className: styles.metricLabel, children: "Initiative" }), _jsx(Zap, { size: 20, style: { marginTop: 8, opacity: 0.3 } })] }), _jsxs("div", { className: styles.metricBox, children: [_jsx("div", { className: styles.metricValue, children: "30 ft" }), _jsx("div", { className: styles.metricLabel, children: "Speed" }), _jsx(Footprints, { size: 20, style: { marginTop: 8, opacity: 0.3 } })] })] }), _jsx("section", { className: styles.section, children: _jsxs("div", { className: styles.metricBox, style: { width: '100%', flexDirection: 'row', gap: '20px' }, children: [_jsx(Heart, { size: 32, color: "#cc0000" }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { className: styles.metricLabel, children: "Hit Points" }), _jsxs("div", { style: { fontSize: '2rem', fontWeight: 800 }, children: [char.hp.current, " / ", char.hp.max] })] })] }) }), _jsxs("section", { className: styles.section, children: [_jsx("h2", { className: styles.sectionTitle, children: "Personality & Traits" }), _jsxs("div", { className: styles.featuresGrid, children: [bio.traits?.map((trait, i) => (_jsxs("div", { className: styles.featureCard, children: [_jsxs("h3", { className: styles.featureName, children: ["Trait ", i + 1] }), _jsx("p", { className: styles.featureDesc, children: trait })] }, i))), bio.ideals?.map((ideal, i) => (_jsxs("div", { className: styles.featureCard, style: { borderLeftColor: '#d4a017' }, children: [_jsx("h3", { className: styles.featureName, children: "Ideal" }), _jsx("p", { className: styles.featureDesc, children: ideal })] }, `ideal-${i}`))), bio.bonds?.map((bond, i) => (_jsxs("div", { className: styles.featureCard, style: { borderLeftColor: '#a855f7' }, children: [_jsx("h3", { className: styles.featureName, children: "Bond" }), _jsx("p", { className: styles.featureDesc, children: bond })] }, `bond-${i}`))), bio.flaws?.map((flaw, i) => (_jsxs("div", { className: styles.featureCard, style: { borderLeftColor: '#ff4d4d' }, children: [_jsx("h3", { className: styles.featureName, children: "Flaw" }), _jsx("p", { className: styles.featureDesc, children: flaw })] }, `flaw-${i}`))), (!bio.traits?.length && !bio.ideals?.length) && _jsx("p", { style: { opacity: 0.5 }, children: "No personality traits defined." })] })] })] })] })] }) }));
};
export default CharacterSheet;
