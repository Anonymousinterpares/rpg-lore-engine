import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './QuestList.module.css';
import { CheckCircle, Circle, Target } from 'lucide-react';
const QuestList = ({ quests }) => {
    if (!quests || quests.length === 0) {
        return (_jsxs("div", { className: styles.empty, children: [_jsx(Target, { size: 32, opacity: 0.2 }), _jsx("p", { children: "No active chronicles" })] }));
    }
    return (_jsx("div", { className: styles.questList, children: quests.map(quest => (_jsxs("div", { className: styles.questCard, children: [_jsx("h4", { className: styles.questTitle, children: quest.title }), _jsx("p", { className: styles.questDesc, children: quest.description }), _jsx("div", { className: styles.objectives, children: quest.objectives.map(obj => (_jsxs("div", { className: `${styles.objective} ${obj.isCompleted ? styles.completed : ''}`, children: [obj.isCompleted ? (_jsx(CheckCircle, { size: 14, className: styles.icon })) : (_jsx(Circle, { size: 14, className: styles.icon })), _jsxs("span", { className: styles.objText, children: [obj.description, obj.maxProgress > 1 && (_jsxs("span", { className: styles.progress, children: ["[", obj.currentProgress, "/", obj.maxProgress, "]"] }))] })] }, obj.id))) })] }, quest.id))) }));
};
export default QuestList;
