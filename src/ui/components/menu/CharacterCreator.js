import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './CharacterCreator.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
const RACES = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc'];
const CLASSES = ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger', 'Paladin'];
const CharacterCreator = ({ onComplete, onCancel }) => {
    const [step, setStep] = useState(1);
    const [char, setChar] = useState({
        name: '',
        race: 'Human',
        class: 'Fighter',
        stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
        background: 'Soldier'
    });
    const nextStep = () => setStep(s => Math.min(s + 1, 5));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));
    const updateStat = (stat, val) => {
        setChar({ ...char, stats: { ...char.stats, [stat]: val } });
    };
    return (_jsx("div", { className: styles.overlay, children: _jsxs("div", { className: `${parchmentStyles.panel} ${styles.modal}`, children: [_jsxs("div", { className: styles.header, children: [_jsxs("h2", { children: ["Character Creation - Step ", step, " of 5"] }), _jsx("div", { className: styles.progress, children: [1, 2, 3, 4, 5].map(s => (_jsx("div", { className: `${styles.dot} ${s <= step ? styles.activeDot : ''}` }, s))) })] }), _jsxs("div", { className: styles.content, children: [step === 1 && (_jsxs("div", { className: styles.step, children: [_jsx("h3", { children: "Select Your Race" }), _jsx("div", { className: styles.optionsGrid, children: RACES.map(r => (_jsx("button", { className: `${styles.optionCard} ${char.race === r ? styles.selected : ''}`, onClick: () => setChar({ ...char, race: r }), children: _jsx("span", { children: r }) }, r))) })] })), step === 2 && (_jsxs("div", { className: styles.step, children: [_jsx("h3", { children: "Choose Your Path" }), _jsx("div", { className: styles.optionsGrid, children: CLASSES.map(c => (_jsx("button", { className: `${styles.optionCard} ${char.class === c ? styles.selected : ''}`, onClick: () => setChar({ ...char, class: c }), children: _jsx("span", { children: c }) }, c))) })] })), step === 3 && (_jsxs("div", { className: styles.step, children: [_jsx("h3", { children: "Distribute Attributes" }), _jsx("div", { className: styles.statsEditor, children: Object.entries(char.stats).map(([stat, val]) => (_jsxs("div", { className: styles.statRow, children: [_jsx("span", { className: styles.statLabel, children: stat }), _jsxs("div", { className: styles.statControls, children: [_jsx("button", { onClick: () => updateStat(stat, val - 1), children: "-" }), _jsx("span", { className: styles.statValue, children: val }), _jsx("button", { onClick: () => updateStat(stat, val + 1), children: "+" })] })] }, stat))) })] })), step === 4 && (_jsxs("div", { className: styles.step, children: [_jsx("h3", { children: "Define Your Origins" }), _jsxs("select", { className: styles.input, value: char.background, onChange: (e) => setChar({ ...char, background: e.target.value }), children: [_jsx("option", { value: "Soldier", children: "Soldier" }), _jsx("option", { value: "Acolyte", children: "Acolyte" }), _jsx("option", { value: "Criminal", children: "Criminal" }), _jsx("option", { value: "Sage", children: "Sage" })] })] })), step === 5 && (_jsxs("div", { className: styles.step, children: [_jsx("h3", { children: "Finalize" }), _jsx("input", { type: "text", className: styles.input, placeholder: "Enter Hero Name...", value: char.name, onChange: (e) => setChar({ ...char, name: e.target.value }) }), _jsxs("div", { className: styles.summary, children: [_jsx("p", { children: _jsx("strong", { children: char.name || 'Unnamed Hero' }) }), _jsxs("p", { children: [char.race, " ", char.class] }), _jsxs("p", { children: ["Background: ", char.background] })] })] }))] }), _jsxs("div", { className: styles.footer, children: [_jsx("button", { className: styles.cancelButton, onClick: onCancel, children: "Cancel" }), _jsxs("div", { className: styles.navButtons, children: [step > 1 && _jsxs("button", { onClick: prevStep, children: [_jsx(ArrowLeft, { size: 18 }), " Back"] }), step < 5 ? (_jsxs("button", { className: styles.primaryButton, onClick: nextStep, children: ["Next ", _jsx(ArrowRight, { size: 18 })] })) : (_jsxs("button", { className: styles.primaryButton, onClick: () => onComplete(char), children: ["Create ", _jsx(Check, { size: 18 })] }))] })] })] }) }));
};
export default CharacterCreator;
