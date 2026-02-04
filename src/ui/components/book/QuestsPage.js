import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './QuestsPage.module.css';
import { useGameState } from '../../hooks/useGameState';
import { Target, CheckCircle, XCircle, Scroll } from 'lucide-react';
const QuestsPage = () => {
    const { state, engine, updateState } = useGameState();
    const [activeTab, setActiveTab] = useState('ACTIVE');
    if (!state)
        return null;
    const quests = state.activeQuests || [];
    const filteredQuests = quests.filter(q => q.status === activeTab);
    const markAsRead = (questId) => {
        if (engine) {
            engine.markQuestAsRead(questId);
            updateState();
        }
    };
    return (_jsxs("div", { className: styles.container, children: [_jsxs("div", { className: styles.sidebar, children: [_jsx("h2", { className: styles.title, children: "Chronicles" }), _jsxs("div", { className: styles.tabs, children: [_jsxs("button", { className: `${styles.tab} ${activeTab === 'ACTIVE' ? styles.active : ''}`, onClick: () => setActiveTab('ACTIVE'), children: [_jsx(Target, { size: 18 }), "Active", quests.some(q => q.status === 'ACTIVE' && q.isNew) && _jsx("div", { className: styles.redDot })] }), _jsxs("button", { className: `${styles.tab} ${activeTab === 'COMPLETED' ? styles.active : ''}`, onClick: () => setActiveTab('COMPLETED'), children: [_jsx(CheckCircle, { size: 18 }), "Completed"] }), _jsxs("button", { className: `${styles.tab} ${activeTab === 'FAILED' ? styles.active : ''}`, onClick: () => setActiveTab('FAILED'), children: [_jsx(XCircle, { size: 18 }), "Failed"] })] })] }), _jsx("div", { className: styles.content, children: filteredQuests.length > 0 ? (_jsx("div", { className: styles.questList, children: filteredQuests.map(quest => (_jsxs("div", { className: `${styles.questCard} ${quest.isNew ? styles.isNew : ''}`, onClick: () => markAsRead(quest.id), children: [_jsxs("div", { className: styles.questHeader, children: [_jsx("h3", { children: quest.title }), quest.isNew && _jsx("span", { className: styles.newBadge, children: "NEW" })] }), _jsx("p", { className: styles.description, children: quest.description }), _jsxs("div", { className: styles.objectives, children: [_jsx("h4", { children: "Objectives" }), quest.objectives.map(obj => (_jsxs("div", { className: `${styles.objective} ${obj.isCompleted ? styles.completed : ''}`, children: [_jsx("div", { className: styles.objCheck, children: obj.isCompleted ? _jsx(CheckCircle, { size: 14 }) : _jsx("div", { className: styles.circle }) }), _jsx("span", { className: styles.objText, children: obj.description }), obj.maxProgress > 1 && (_jsxs("span", { className: styles.progress, children: ["[", obj.currentProgress, "/", obj.maxProgress, "]"] }))] }, obj.id)))] }), quest.rewards && (_jsxs("div", { className: styles.rewards, children: [_jsx("h4", { children: "Rewards" }), _jsxs("div", { className: styles.rewardTags, children: [quest.rewards.xp > 0 && _jsxs("span", { className: styles.rewardTag, children: [quest.rewards.xp, " XP"] }), quest.rewards.gold && _jsxs("span", { className: styles.rewardTag, children: [quest.rewards.gold.gp, " GP"] })] })] }))] }, quest.id))) })) : (_jsxs("div", { className: styles.emptyState, children: [_jsx(Scroll, { size: 60 }), _jsx("p", { children: "No chronicles found in this section." })] })) })] }));
};
export default QuestsPage;
