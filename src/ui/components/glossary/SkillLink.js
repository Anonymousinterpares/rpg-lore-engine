import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './SkillLink.module.css';
import skillsData from '../../../data/codex/skills.json';
import { X, Info } from 'lucide-react';
const SkillLink = ({ skillName, className, inheritColor }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Find skill data, handling case sensitivity and "Skill: " prefix
    const cleanName = skillName.replace('Skill: ', '');
    const skill = skillsData.find(s => s.name.toLowerCase() === cleanName.toLowerCase());
    if (!skill)
        return _jsx("span", { className: className, children: skillName });
    return (_jsxs(_Fragment, { children: [_jsx("span", { className: `${styles.link} ${inheritColor ? styles.inheritColor : ''} ${className || ''}`, onClick: (e) => {
                    e.stopPropagation();
                    setIsOpen(true);
                }, children: skillName }), isOpen && (_jsx("div", { className: styles.overlay, onClick: () => setIsOpen(false), children: _jsxs("div", { className: styles.modal, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.titleRow, children: [_jsx(Info, { className: styles.icon, size: 20 }), _jsx("h3", { children: skill.name })] }), _jsx("button", { className: styles.closeBtn, onClick: () => setIsOpen(false), children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: styles.content, children: [_jsxs("div", { className: styles.statLine, children: [_jsx("strong", { children: "Governing Ability:" }), " ", skill.ability] }), _jsx("p", { className: styles.description, children: skill.description }), _jsxs("div", { className: styles.examplesSection, children: [_jsx("h4", { children: "Common Uses:" }), _jsx("ul", { children: skill.examples.map((ex, i) => (_jsx("li", { children: ex }, i))) })] })] })] }) }))] }));
};
export default SkillLink;
