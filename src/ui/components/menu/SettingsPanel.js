import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './SettingsPanel.module.css';
import glassStyles from '../../styles/glass.module.css';
import { Settings, Volume2, Monitor, Gamepad, X, Cpu } from 'lucide-react';
import { LLM_PROVIDERS } from '../../../ruleset/data/StaticData';
import { LLMClient } from '../../../ruleset/combat/LLMClient';
const SettingsPanel = ({ onClose, onSave, initialSettings, className = '' }) => {
    const [settings, setSettings] = useState(initialSettings);
    const [activeTab, setActiveTab] = useState('video');
    const [apiKeys, setApiKeys] = useState({});
    const [testResults, setTestResults] = useState({});
    useEffect(() => {
        const loadKeys = async () => {
            const keys = {};
            for (const p of LLM_PROVIDERS) {
                const key = await LLMClient.getApiKey(p);
                if (key)
                    keys[p.id] = key;
            }
            setApiKeys(keys);
        };
        loadKeys();
    }, []);
    const updateApiKey = (id, value) => {
        setApiKeys({ ...apiKeys, [id]: value });
        LLMClient.setApiKey(id, value);
    };
    const testProvider = async (provider) => {
        setTestResults(prev => ({ ...prev, [provider.id]: { success: false, message: 'Testing...' } }));
        const result = await LLMClient.testConnection(provider, provider.models[0]);
        setTestResults(prev => ({ ...prev, [provider.id]: result }));
    };
    const handleToggle = (key, section) => {
        setSettings({
            ...settings,
            [section]: {
                ...settings[section],
                [key]: !settings[section][key]
            }
        });
    };
    const handleSlider = (key, section, value) => {
        setSettings({
            ...settings,
            [section]: {
                ...settings[section],
                [key]: value
            }
        });
    };
    return (_jsx("div", { className: `${styles.overlay} ${className}`, children: _jsxs("div", { className: `${styles.modal} ${glassStyles.glassPanel}`, children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.headerTitle, children: [_jsx(Settings, { size: 24 }), _jsx("h2", { children: "System Settings" })] }), _jsx("button", { className: styles.closeButton, onClick: onClose, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: styles.layout, children: [_jsxs("div", { className: styles.sidebar, children: [_jsxs("button", { className: `${styles.tabButton} ${activeTab === 'video' ? styles.activeTab : ''}`, onClick: () => setActiveTab('video'), children: [_jsx(Monitor, { size: 18 }), _jsx("span", { children: "Video" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'audio' ? styles.activeTab : ''}`, onClick: () => setActiveTab('audio'), children: [_jsx(Volume2, { size: 18 }), _jsx("span", { children: "Audio" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'gameplay' ? styles.activeTab : ''}`, onClick: () => setActiveTab('gameplay'), children: [_jsx(Gamepad, { size: 18 }), _jsx("span", { children: "Gameplay" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'ai' ? styles.activeTab : ''}`, onClick: () => setActiveTab('ai'), children: [_jsx(Cpu, { size: 18 }), _jsx("span", { children: "AI Service" })] })] }), _jsxs("div", { className: styles.main, children: [activeTab === 'video' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Video Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Full Screen" }), _jsx("input", { type: "checkbox", checked: settings.video.fullscreen, onChange: () => handleToggle('fullscreen', 'video') })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "V-Sync" }), _jsx("input", { type: "checkbox", checked: settings.video.vsync, onChange: () => handleToggle('vsync', 'video') })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Resolution Scale" }), _jsx("input", { type: "range", min: "0.5", max: "2.0", step: "0.1", value: settings.video.resolutionScale, onChange: (e) => handleSlider('resolutionScale', 'video', parseFloat(e.target.value)) }), _jsxs("span", { children: [Math.round(settings.video.resolutionScale * 100), "%"] })] })] })), activeTab === 'audio' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Audio Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Master Volume" }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: settings.audio.master, onChange: (e) => handleSlider('master', 'audio', parseFloat(e.target.value)) })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Music" }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: settings.audio.music, onChange: (e) => handleSlider('music', 'audio', parseFloat(e.target.value)) })] })] })), activeTab === 'gameplay' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Gameplay Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Difficulty" }), _jsxs("select", { value: settings.gameplay.difficulty, onChange: (e) => handleSlider('difficulty', 'gameplay', e.target.value), children: [_jsx("option", { value: "easy", children: "Easy" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "hard", children: "Hard" })] })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Tutorial Tips" }), _jsx("input", { type: "checkbox", checked: settings.gameplay.tutorials, onChange: () => handleToggle('tutorials', 'gameplay') })] })] })), activeTab === 'ai' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "AI Service Configuration" }), _jsx("p", { className: styles.hint, children: "Configure your LLM providers. Keys are stored locally." }), LLM_PROVIDERS.map(provider => (_jsxs("div", { className: styles.apiBlock, children: [_jsxs("div", { className: styles.apiHeader, children: [_jsx("strong", { children: provider.name }), _jsx("button", { className: styles.testButton, onClick: () => testProvider(provider), children: "Test Connection" })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "API Key" }), _jsx("input", { type: "password", value: apiKeys[provider.id] || '', onChange: (e) => updateApiKey(provider.id, e.target.value), placeholder: `Enter ${provider.name} Key` })] }), testResults[provider.id] && (_jsxs("div", { className: `${styles.testStatus} ${testResults[provider.id].success ? styles.success : styles.error}`, children: [testResults[provider.id].message, testResults[provider.id].latencyMs && ` (${testResults[provider.id].latencyMs}ms)`] }))] }, provider.id)))] }))] })] }), _jsxs("div", { className: styles.footer, children: [_jsx("button", { className: styles.saveButton, onClick: () => onSave(settings), children: "Save Changes" }), _jsx("button", { className: styles.cancelButton, onClick: onClose, children: "Cancel" })] })] }) }));
};
export default SettingsPanel;
