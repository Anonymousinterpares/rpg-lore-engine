import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './SettingsPanel.module.css';
import { Settings, Volume2, Monitor, Gamepad, X, Cpu, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { LLM_PROVIDERS } from '../../../ruleset/data/StaticData';
import { LLMClient } from '../../../ruleset/combat/LLMClient';
const SettingsPanel = ({ onClose, onSave, initialSettings, className = '' }) => {
    const [settings, setSettings] = useState(initialSettings);
    const [activeTab, setActiveTab] = useState('video');
    const [apiKeys, setApiKeys] = useState({});
    const [selectedModels, setSelectedModels] = useState({});
    const [testResults, setTestResults] = useState({});
    const [testingProvider, setTestingProvider] = useState(null);
    useEffect(() => {
        const loadKeys = async () => {
            const keys = {};
            const models = {};
            for (const p of LLM_PROVIDERS) {
                const key = await LLMClient.getApiKey(p);
                if (key)
                    keys[p.id] = key;
                // Default to first model if not set (future: load from settings)
                models[p.id] = p.models[0].id;
            }
            setApiKeys(keys);
            setSelectedModels(models);
        };
        loadKeys();
    }, []);
    const updateApiKey = (id, value) => {
        setApiKeys({ ...apiKeys, [id]: value });
        LLMClient.setApiKey(id, value);
    };
    const updateModel = (providerId, modelId) => {
        setSelectedModels({ ...selectedModels, [providerId]: modelId });
    };
    const testProvider = async (provider) => {
        if (!apiKeys[provider.id])
            return;
        setTestingProvider(provider.id);
        setTestResults(prev => ({ ...prev, [provider.id]: { success: false, message: '' } })); // Clear previous result
        const modelConfig = provider.models.find(m => m.id === selectedModels[provider.id]) || provider.models[0];
        try {
            const result = await LLMClient.testConnection(provider, modelConfig);
            setTestResults(prev => ({ ...prev, [provider.id]: result }));
        }
        finally {
            setTestingProvider(null);
        }
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
    return (_jsx("div", { className: `${styles.overlay} ${className}`, children: _jsxs("div", { className: styles.modal, children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.headerTitle, children: [_jsx(Settings, { size: 24 }), _jsx("h2", { children: "System Settings" })] }), _jsx("button", { className: styles.closeButton, onClick: onClose, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: styles.layout, children: [_jsxs("div", { className: styles.sidebar, children: [_jsxs("button", { className: `${styles.tabButton} ${activeTab === 'video' ? styles.activeTab : ''}`, onClick: () => setActiveTab('video'), children: [_jsx(Monitor, { size: 18 }), _jsx("span", { children: "Video" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'audio' ? styles.activeTab : ''}`, onClick: () => setActiveTab('audio'), children: [_jsx(Volume2, { size: 18 }), _jsx("span", { children: "Audio" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'gameplay' ? styles.activeTab : ''}`, onClick: () => setActiveTab('gameplay'), children: [_jsx(Gamepad, { size: 18 }), _jsx("span", { children: "Gameplay" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'ai' ? styles.activeTab : ''}`, onClick: () => setActiveTab('ai'), children: [_jsx(Cpu, { size: 18 }), _jsx("span", { children: "AI Service" })] })] }), _jsxs("div", { className: styles.main, children: [activeTab === 'video' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Video Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Full Screen" }), _jsx("input", { type: "checkbox", checked: settings.video.fullscreen, onChange: () => handleToggle('fullscreen', 'video') })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "V-Sync" }), _jsx("input", { type: "checkbox", checked: settings.video.vsync, onChange: () => handleToggle('vsync', 'video') })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Resolution Scale" }), _jsx("input", { type: "range", min: "0.5", max: "2.0", step: "0.1", value: settings.video.resolutionScale, onChange: (e) => handleSlider('resolutionScale', 'video', parseFloat(e.target.value)) }), _jsxs("span", { children: [Math.round(settings.video.resolutionScale * 100), "%"] })] })] })), activeTab === 'audio' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Audio Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Master Volume" }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: settings.audio.master, onChange: (e) => handleSlider('master', 'audio', parseFloat(e.target.value)) })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Music" }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: settings.audio.music, onChange: (e) => handleSlider('music', 'audio', parseFloat(e.target.value)) })] })] })), activeTab === 'gameplay' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Gameplay Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Difficulty" }), _jsxs("select", { value: settings.gameplay.difficulty, onChange: (e) => handleSlider('difficulty', 'gameplay', e.target.value), children: [_jsx("option", { value: "easy", children: "Easy" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "hard", children: "Hard" })] })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Tutorial Tips" }), _jsx("input", { type: "checkbox", checked: settings.gameplay.tutorials, onChange: () => handleToggle('tutorials', 'gameplay') })] })] })), activeTab === 'ai' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "AI Service Configuration" }), _jsx("p", { className: styles.hint, children: "Configure your LLM providers. Keys are stored safely in local storage." }), _jsx("div", { className: styles.providerList, children: LLM_PROVIDERS.map(provider => (_jsxs("div", { className: styles.apiBlock, children: [_jsxs("div", { className: styles.apiHeader, children: [_jsx("strong", { children: provider.name }), _jsx("div", { className: styles.providerMeta, children: apiKeys[provider.id] ?
                                                                    _jsx("span", { className: styles.keyBadge, children: "Key Set" }) :
                                                                    _jsx("span", { className: styles.keyBadgeMissing, children: "No Key" }) })] }), _jsxs("div", { className: styles.inputGroup, children: [_jsx("label", { children: "API Key" }), _jsx("input", { type: "password", value: apiKeys[provider.id] || '', onChange: (e) => updateApiKey(provider.id, e.target.value), placeholder: `sk-...`, className: styles.keyInput })] }), _jsxs("div", { className: styles.inputGroup, children: [_jsx("label", { children: "Model" }), _jsx("select", { value: selectedModels[provider.id] || '', onChange: (e) => updateModel(provider.id, e.target.value), className: styles.modelSelect, children: provider.models.map(m => (_jsx("option", { value: m.id, children: m.displayName }, m.id))) })] }), _jsxs("div", { className: styles.apiActions, children: [_jsx("button", { className: styles.testButton, onClick: () => testProvider(provider), disabled: !apiKeys[provider.id] || testingProvider === provider.id, children: testingProvider === provider.id ?
                                                                    _jsxs(_Fragment, { children: [_jsx(Loader, { size: 12, className: styles.spin }), " Testing..."] }) :
                                                                    'Test Connection' }), testResults[provider.id] && (_jsxs("div", { className: `${styles.testStatus} ${testResults[provider.id].success ? styles.success : styles.error}`, children: [testResults[provider.id].success ? _jsx(CheckCircle, { size: 14 }) : _jsx(AlertCircle, { size: 14 }), _jsx("span", { children: testResults[provider.id].message }), testResults[provider.id].latencyMs && _jsxs("span", { className: styles.latency, children: ["(", testResults[provider.id].latencyMs, "ms)"] })] }))] })] }, provider.id))) })] }))] })] }), _jsxs("div", { className: styles.footer, children: [_jsx("button", { className: styles.saveButton, onClick: () => onSave({ ...settings, ai: { ...settings.ai, selectedModels } }), children: "Save Changes" }), _jsx("button", { className: styles.cancelButton, onClick: onClose, children: "Cancel" })] })] }) }));
};
export default SettingsPanel;
