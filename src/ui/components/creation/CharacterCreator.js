import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './CharacterCreator.module.css';
import { DataManager } from '../../../ruleset/data/DataManager';
import { CharacterFactory } from '../../../ruleset/factories/CharacterFactory';
import { ArrowRight, ArrowLeft, Check, Dice5 } from 'lucide-react';
const STEPS = ['Identity', 'Race', 'Class', 'Background', 'Abilities', 'Review'];
const CharacterCreator = ({ onComplete, onCancel }) => {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [races, setRaces] = useState([]);
    const [classes, setClasses] = useState([]);
    const [backgrounds, setBackgrounds] = useState([]);
    // Form State
    const [name, setName] = useState('');
    const [selectedRace, setSelectedRace] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedBackground, setSelectedBackground] = useState(null);
    const [abilities, setAbilities] = useState({
        STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10
    });
    useEffect(() => {
        const init = async () => {
            await DataManager.initialize();
            setRaces(DataManager.getRaces());
            setClasses(DataManager.getClasses());
            setBackgrounds(DataManager.getBackgrounds());
            setLoading(false);
        };
        init();
    }, []);
    const handleNext = () => {
        if (step < STEPS.length - 1)
            setStep(step + 1);
    };
    const handleBack = () => {
        if (step > 0)
            setStep(step - 1);
    };
    const handleFinish = () => {
        if (!selectedRace || !selectedClass || !selectedBackground)
            return;
        const newState = CharacterFactory.createNewGameState({
            name: name || 'Traveler',
            race: selectedRace,
            characterClass: selectedClass,
            background: selectedBackground,
            abilityScores: abilities
        });
        onComplete(newState);
    };
    const rollStats = () => {
        // Simple 4d6 drop lowest generator
        const roll = () => {
            const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
            dice.sort((a, b) => a - b);
            return dice.slice(1).reduce((a, b) => a + b, 0);
        };
        setAbilities({
            STR: roll(), DEX: roll(), CON: roll(), INT: roll(), WIS: roll(), CHA: roll()
        });
    };
    const handleAbilityChange = (key, value) => {
        let val = parseInt(value) || 0;
        // Clamp between 3 and 20
        val = Math.max(3, Math.min(20, val));
        setAbilities({ ...abilities, [key]: val });
    };
    if (loading)
        return _jsx("div", { className: styles.overlay, children: _jsx("div", { className: styles.loader, children: "Opening the Rulebooks..." }) });
    const renderStepContent = () => {
        switch (step) {
            case 0: // Identity
                return (_jsxs("div", { className: styles.stepContainer, children: [_jsx("h3", { children: "Who are you?" }), _jsxs("div", { className: styles.inputGroup, children: [_jsx("label", { children: "Character Name" }), _jsx("input", { type: "text", value: name, onChange: e => setName(e.target.value), placeholder: "Enter name...", className: styles.input, autoFocus: true })] })] }));
            case 1: // Race
                return (_jsxs("div", { className: styles.selectionLayout, children: [_jsx("div", { className: styles.gridContainer, children: races.map(r => (_jsxs("div", { className: `${styles.card} ${selectedRace?.name === r.name ? styles.selected : ''}`, onClick: () => setSelectedRace(r), children: [_jsx("h4", { children: r.name }), _jsxs("p", { className: styles.smallInfo, children: [_jsx("strong", { children: "Speed:" }), " ", r.speed, "ft | ", _jsx("strong", { children: "Size:" }), " ", r.size] }), _jsx("p", { className: styles.smallInfo, children: r.traits.map(t => t.name).join(', ') })] }, r.name))) }), selectedRace && (_jsxs("div", { className: styles.detailsPanel, children: [_jsxs("h3", { children: [selectedRace.name, " Traits"] }), _jsxs("div", { className: styles.detailsContent, children: [selectedRace.traits.map(t => (_jsxs("div", { className: styles.detailItem, children: [_jsx("div", { className: styles.detailName, children: t.name }), _jsx("div", { className: styles.detailDesc, children: t.description })] }, t.name))), _jsxs("div", { className: styles.detailItem, children: [_jsx("div", { className: styles.detailName, children: "Ability Score Increases" }), _jsx("div", { className: styles.detailDesc, children: Object.entries(selectedRace.abilityScoreIncreases).map(([stat, bonus]) => `${stat} +${bonus}`).join(', ') })] }), _jsxs("div", { className: styles.detailItem, children: [_jsx("div", { className: styles.detailName, children: "Languages" }), _jsx("div", { className: styles.detailDesc, children: selectedRace.languages.join(', ') })] })] })] }))] }));
            case 2: // Class
                return (_jsxs("div", { className: styles.selectionLayout, children: [_jsx("div", { className: styles.gridContainer, children: classes.map(c => (_jsxs("div", { className: `${styles.card} ${selectedClass?.name === c.name ? styles.selected : ''}`, onClick: () => setSelectedClass(c), children: [_jsx("h4", { children: c.name }), _jsxs("p", { className: styles.smallInfo, children: [_jsx("strong", { children: "Hit Die:" }), " ", c.hitDie, " | ", _jsx("strong", { children: "Primary:" }), " ", c.primaryAbility.join(', ')] })] }, c.name))) }), selectedClass && (_jsxs("div", { className: styles.detailsPanel, children: [_jsxs("h3", { children: [selectedClass.name, " Features"] }), _jsxs("div", { className: styles.detailsContent, children: [selectedClass.allFeatures.filter(f => f.level === 1).map(f => (_jsxs("div", { className: styles.detailItem, children: [_jsx("div", { className: styles.detailName, children: f.name }), _jsx("div", { className: styles.detailDesc, children: f.description })] }, f.name))), _jsxs("div", { className: styles.detailItem, children: [_jsx("div", { className: styles.detailName, children: "Proficiencies" }), _jsxs("div", { className: styles.detailDesc, children: [_jsx("strong", { children: "Armor:" }), " ", selectedClass.armorProficiencies.join(', ') || 'None', _jsx("br", {}), _jsx("strong", { children: "Weapons:" }), " ", selectedClass.weaponProficiencies.join(', ') || 'None', _jsx("br", {}), _jsx("strong", { children: "Saves:" }), " ", selectedClass.savingThrowProficiencies.join(', ')] })] })] })] }))] }));
            case 3: // Background
                return (_jsxs("div", { className: styles.selectionLayout, children: [_jsx("div", { className: styles.gridContainer, children: backgrounds.map(b => (_jsxs("div", { className: `${styles.card} ${selectedBackground?.name === b.name ? styles.selected : ''}`, onClick: () => setSelectedBackground(b), children: [_jsx("h4", { children: b.name }), _jsx("p", { className: styles.smallInfo, children: b.description.length > 100 ? b.description.substring(0, 100) + '...' : b.description })] }, b.name))) }), selectedBackground && (_jsxs("div", { className: styles.detailsPanel, children: [_jsxs("h3", { children: [selectedBackground.name, " Background"] }), _jsxs("div", { className: styles.detailsContent, children: [_jsxs("div", { className: styles.detailItem, children: [_jsx("div", { className: styles.detailName, children: selectedBackground.feature.name }), _jsx("div", { className: styles.detailDesc, children: selectedBackground.feature.description })] }), _jsxs("div", { className: styles.detailItem, children: [_jsx("div", { className: styles.detailName, children: "Proficiencies & Languages" }), _jsxs("div", { className: styles.detailDesc, children: [_jsx("strong", { children: "Skills:" }), " ", selectedBackground.skillProficiencies.join(', '), _jsx("br", {}), selectedBackground.toolProficiencies.length > 0 && _jsxs(_Fragment, { children: [_jsx("strong", { children: "Tools:" }), " ", selectedBackground.toolProficiencies.join(', '), _jsx("br", {})] }), selectedBackground.languages.length > 0 && _jsxs(_Fragment, { children: [_jsx("strong", { children: "Languages:" }), " ", selectedBackground.languages.join(', ')] })] })] }), selectedBackground.personalitySuggested && (_jsxs("div", { className: styles.detailItem, children: [_jsx("div", { className: styles.detailName, children: "Sample Traits" }), _jsx("div", { className: styles.detailDesc, children: selectedBackground.personalitySuggested.traits[0] })] }))] })] }))] }));
            case 4: // Abilities
                return (_jsxs("div", { className: styles.stepContainer, children: [_jsxs("div", { className: styles.statsHeader, children: [_jsx("h3", { children: "Ability Scores" }), _jsxs("button", { className: styles.rollButton, onClick: rollStats, children: [_jsx(Dice5, { size: 18 }), " Roll Stats"] })] }), _jsx("div", { className: styles.statsGrid, children: Object.entries(abilities).map(([key, val]) => (_jsxs("div", { className: styles.statBox, children: [_jsx("label", { children: key }), _jsx("input", { type: "number", value: val, onChange: e => handleAbilityChange(key, e.target.value), min: 3, max: 20 }), _jsxs("span", { className: styles.mod, children: [Math.floor((val - 10) / 2) >= 0 ? '+' : '', Math.floor((val - 10) / 2)] })] }, key))) })] }));
            case 5: // Review
                return (_jsxs("div", { className: styles.summary, children: [_jsx("h3", { children: "Review Character" }), _jsxs("p", { children: [_jsx("strong", { children: "Name:" }), " ", name || 'Unknown'] }), _jsxs("p", { children: [_jsx("strong", { children: "Race:" }), " ", selectedRace?.name] }), _jsxs("p", { children: [_jsx("strong", { children: "Class:" }), " ", selectedClass?.name] }), _jsxs("p", { children: [_jsx("strong", { children: "Background:" }), " ", selectedBackground?.name] }), _jsx("div", { className: styles.statsSummary, children: Object.entries(abilities).map(([k, v]) => _jsxs("span", { children: [k, ":", v] }, k)) })] }));
            default:
                return null;
        }
    };
    const isNextDisabled = () => {
        if (step === 0 && name.trim().length === 0)
            return true;
        if (step === 1 && !selectedRace)
            return true;
        if (step === 2 && !selectedClass)
            return true;
        if (step === 3 && !selectedBackground)
            return true;
        return false;
    };
    return (_jsx("div", { className: styles.overlay, children: _jsxs("div", { className: styles.modal, children: [_jsxs("div", { className: styles.header, children: [_jsx("h2", { children: "Character Creation" }), _jsx("div", { className: styles.steps, children: STEPS.map((s, i) => (_jsx("span", { className: i === step ? styles.activeStep : (i < step ? styles.completedStep : styles.inactiveStep), children: s }, s))) })] }), _jsx("div", { className: styles.content, children: renderStepContent() }), _jsxs("div", { className: styles.footer, children: [_jsx("button", { className: styles.secondaryButton, onClick: step === 0 ? onCancel : handleBack, children: step === 0 ? 'Cancel' : _jsxs(_Fragment, { children: [_jsx(ArrowLeft, { size: 16 }), " Back"] }) }), step < STEPS.length - 1 ? (_jsxs("button", { className: styles.primaryButton, onClick: handleNext, disabled: isNextDisabled(), children: ["Next ", _jsx(ArrowRight, { size: 16 })] })) : (_jsxs("button", { className: styles.primaryButton, onClick: handleFinish, children: ["Start Adventure ", _jsx(Check, { size: 16 })] }))] })] }) }));
};
export default CharacterCreator;
