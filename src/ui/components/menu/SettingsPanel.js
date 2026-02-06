import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './SettingsPanel.module.css';
import { Settings, Volume2, Monitor, Gamepad, X, Cpu, CheckCircle, AlertCircle, Loader, Users, Download, Upload, RotateCcw } from 'lucide-react';
import { LLM_PROVIDERS } from '../../../ruleset/data/StaticData';
import { LLMClient } from '../../../ruleset/combat/LLMClient';
import { AgentManager } from '../../../ruleset/agents/AgentManager';
const SettingsPanel = ({ onClose, onSave, initialSettings, className = '', isPage = false }) => {
    const [settings, setSettings] = useState(initialSettings);
    const [activeTab, setActiveTab] = useState('video');
    const [apiKeys, setApiKeys] = useState({});
    const [selectedModels, setSelectedModels] = useState({});
    const [testResults, setTestResults] = useState({});
    const [testingProvider, setTestingProvider] = useState(null);
    const [testingAgent, setTestingAgent] = useState(null);
    const [swarmConfig, setSwarmConfig] = useState(AgentManager.getConfig());
    useEffect(() => {
        const loadKeys = async () => {
            const keys = {};
            const models = {};
            for (const p of LLM_PROVIDERS) {
                const key = await LLMClient.getApiKey(p);
                if (key)
                    keys[p.id] = key;
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
    const updateAgentModel = (type, providerId, modelId) => {
        const currentProfile = swarmConfig[type];
        if (!currentProfile)
            return;
        const profile = {
            id: type,
            name: currentProfile.name,
            providerId,
            modelId,
            basePrompt: currentProfile.basePrompt,
            temperature: currentProfile.temperature,
            maxTokens: currentProfile.maxTokens
        };
        setSwarmConfig({ ...swarmConfig, [type]: profile });
        AgentManager.saveAgentProfile(profile);
    };
    const updateAgentParam = (type, param, value) => {
        const currentProfile = swarmConfig[type];
        if (!currentProfile)
            return;
        const profile = { ...currentProfile, [param]: value };
        setSwarmConfig({ ...swarmConfig, [type]: profile });
        AgentManager.saveAgentProfile(profile);
    };
    const resetAgent = (type) => {
        AgentManager.resetAgent(type);
        setSwarmConfig(AgentManager.getConfig());
    };
    const handleExport = () => {
        const config = AgentManager.exportConfig();
        const blob = new Blob([config], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rpg_agent_config.json';
        a.click();
        URL.revokeObjectURL(url);
    };
    const handleImport = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result;
            const res = AgentManager.importConfig(result);
            if (res.success) {
                setSwarmConfig(AgentManager.getConfig());
                alert('Configuration imported successfully!');
            }
            else {
                alert(`Import failed: ${res.error}`);
            }
        };
        reader.readAsText(file);
    };
    const testProvider = async (provider) => {
        if (!apiKeys[provider.id])
            return;
        setTestingProvider(provider.id);
        setTestResults(prev => ({ ...prev, [provider.id]: { success: false, message: '' } }));
        const modelConfig = provider.models.find(m => m.id === selectedModels[provider.id]) || provider.models[0];
        try {
            const result = await LLMClient.testConnection(provider, modelConfig);
            setTestResults(prev => ({ ...prev, [provider.id]: result }));
        }
        finally {
            setTestingProvider(null);
        }
    };
    const testAgent = async (type, profile) => {
        setTestingAgent(type);
        setTestResults(prev => ({ ...prev, [`agent_${type}`]: { success: false, message: '' } }));
        console.log(`[SettingsPanel] Testing Agent: ${profile.name} (${type})...`);
        try {
            const provider = AgentManager.getProviderForAgent(profile);
            const model = AgentManager.getModelForAgent(profile);
            if (!provider || !model) {
                const err = { success: false, message: 'Invalid provider/model config.' };
                setTestResults(prev => ({ ...prev, [`agent_${type}`]: err }));
                return;
            }
            const result = await LLMClient.testConnection(provider, model);
            // Log full output to console as requested by user
            if (result.success) {
                console.log(`[Agent Test Success] ${profile.name} is ready.`);
            }
            else {
                console.error(`[Agent Test Failed] ${profile.name}: ${result.message}`);
            }
            setTestResults(prev => ({ ...prev, [`agent_${type}`]: result }));
        }
        catch (e) {
            setTestResults(prev => ({ ...prev, [`agent_${type}`]: { success: false, message: e.message } }));
        }
        finally {
            setTestingAgent(null);
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
    const panelContent = (_jsxs("div", { className: `${styles.modal} ${isPage ? styles.isPage : ''}`, children: [!isPage && (_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.headerTitle, children: [_jsx(Settings, { size: 24 }), _jsx("h2", { children: "System Settings" })] }), _jsx("button", { className: styles.closeButton, onClick: onClose, children: _jsx(X, { size: 20 }) })] })), _jsxs("div", { className: styles.layout, children: [_jsxs("div", { className: styles.sidebar, children: [_jsxs("button", { className: `${styles.tabButton} ${activeTab === 'video' ? styles.activeTab : ''}`, onClick: () => setActiveTab('video'), children: [_jsx(Monitor, { size: 18 }), _jsx("span", { children: "Video" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'audio' ? styles.activeTab : ''}`, onClick: () => setActiveTab('audio'), children: [_jsx(Volume2, { size: 18 }), _jsx("span", { children: "Audio" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'gameplay' ? styles.activeTab : ''}`, onClick: () => setActiveTab('gameplay'), children: [_jsx(Gamepad, { size: 18 }), _jsx("span", { children: "Gameplay" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'ai' ? styles.activeTab : ''}`, onClick: () => setActiveTab('ai'), children: [_jsx(Cpu, { size: 18 }), _jsx("span", { children: "AI Providers" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'agents' ? styles.activeTab : ''}`, onClick: () => setActiveTab('agents'), children: [_jsx(Users, { size: 18 }), _jsx("span", { children: "AI Agents" })] })] }), _jsxs("div", { className: styles.main, children: [activeTab === 'video' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Video Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Full Screen" }), _jsx("input", { type: "checkbox", checked: settings.video.fullscreen, onChange: () => handleToggle('fullscreen', 'video') })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "V-Sync" }), _jsx("input", { type: "checkbox", checked: settings.video.vsync, onChange: () => handleToggle('vsync', 'video') })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Resolution Scale" }), _jsx("input", { type: "range", min: "0.5", max: "2.0", step: "0.1", value: settings.video.resolutionScale, onChange: (e) => handleSlider('resolutionScale', 'video', parseFloat(e.target.value)) }), _jsxs("span", { children: [Math.round(settings.video.resolutionScale * 100), "%"] })] })] })), activeTab === 'audio' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Audio Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Master Volume" }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: settings.audio.master, onChange: (e) => handleSlider('master', 'audio', parseFloat(e.target.value)) })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Music" }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: settings.audio.music, onChange: (e) => handleSlider('music', 'audio', parseFloat(e.target.value)) })] })] })), activeTab === 'gameplay' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Gameplay Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Difficulty" }), _jsxs("select", { value: settings.gameplay.difficulty, onChange: (e) => handleSlider('difficulty', 'gameplay', e.target.value), children: [_jsx("option", { value: "easy", children: "Easy" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "hard", children: "Hard" })] })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Tutorial Tips" }), _jsx("input", { type: "checkbox", checked: settings.gameplay.tutorials, onChange: () => handleToggle('tutorials', 'gameplay') })] })] })), activeTab === 'ai' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "AI Service Configuration" }), _jsx("p", { className: styles.hint, children: "Configure your LLM providers. Keys are stored safely in local storage." }), _jsx("div", { className: styles.providerList, children: LLM_PROVIDERS.map(provider => (_jsxs("div", { className: styles.apiBlock, children: [_jsxs("div", { className: styles.apiHeader, children: [_jsx("strong", { children: provider.name }), _jsx("div", { className: styles.providerMeta, children: apiKeys[provider.id] ?
                                                                _jsx("span", { className: styles.keyBadge, children: "Key Set" }) :
                                                                _jsx("span", { className: styles.keyBadgeMissing, children: "No Key" }) })] }), _jsxs("div", { className: styles.inputGroup, children: [_jsx("label", { children: "API Key" }), _jsx("input", { type: "password", value: apiKeys[provider.id] || '', onChange: (e) => updateApiKey(provider.id, e.target.value), placeholder: `sk-...`, className: styles.keyInput })] }), _jsxs("div", { className: styles.inputGroup, children: [_jsx("label", { children: "Test Model" }), _jsx("select", { value: selectedModels[provider.id] || '', onChange: (e) => updateModel(provider.id, e.target.value), className: styles.modelSelect, children: provider.models.map(m => (_jsx("option", { value: m.id, children: m.displayName }, m.id))) })] }), _jsxs("div", { className: styles.apiActions, children: [_jsx("button", { className: styles.testButton, onClick: () => testProvider(provider), disabled: !apiKeys[provider.id] || testingProvider === provider.id, children: testingProvider === provider.id ?
                                                                _jsxs(_Fragment, { children: [_jsx(Loader, { size: 12, className: styles.spin }), " Testing..."] }) :
                                                                'Test Connection' }), testResults[provider.id] && (_jsxs("div", { className: `${styles.testStatus} ${testResults[provider.id].success ? styles.success : styles.error}`, children: [testResults[provider.id].success ? _jsx(CheckCircle, { size: 14 }) : _jsx(AlertCircle, { size: 14 }), _jsx("span", { children: testResults[provider.id].message }), testResults[provider.id].latencyMs && _jsxs("span", { className: styles.latency, children: ["(", testResults[provider.id].latencyMs, "ms)"] })] }))] })] }, provider.id))) })] })), activeTab === 'agents' && (_jsxs("div", { className: styles.section, children: [_jsxs("div", { className: styles.sectionHeader, children: [_jsx("h3", { children: "Agent Role Assignment" }), _jsxs("div", { className: styles.actionGroup, children: [_jsxs("button", { className: styles.iconButton, onClick: handleExport, title: "Export Config", children: [_jsx(Download, { size: 16 }), _jsx("span", { children: "Export" })] }), _jsxs("label", { className: styles.iconButton, title: "Import Config", children: [_jsx(Upload, { size: 16 }), _jsx("span", { children: "Import" }), _jsx("input", { type: "file", accept: ".json", onChange: handleImport, hidden: true })] })] })] }), _jsx("p", { className: styles.hint, children: "Map specialized game agents to specific LLM models. Settings are saved to browser local storage." }), _jsx("div", { className: styles.agentList, children: Object.entries(swarmConfig).map(([type, profile]) => {
                                            const provider = LLM_PROVIDERS.find(p => p.id === profile.providerId);
                                            return (_jsxs("div", { className: styles.apiBlock, children: [_jsxs("div", { className: styles.apiHeader, children: [_jsxs("div", { className: styles.agentName, children: [_jsx("strong", { children: profile.name }), _jsx("span", { className: styles.roleTag, children: type })] }), _jsx("button", { className: styles.resetButton, onClick: () => resetAgent(type), title: "Reset to Default", children: _jsx(RotateCcw, { size: 14 }) })] }), _jsxs("div", { className: styles.agentParameters, children: [_jsxs("div", { className: styles.inputGroup, children: [_jsx("label", { children: "Provider" }), _jsx("select", { value: profile.providerId, onChange: (e) => updateAgentModel(type, e.target.value, LLM_PROVIDERS.find(p => p.id === e.target.value)?.models[0].id || ''), className: styles.modelSelect, children: LLM_PROVIDERS.map(p => (_jsx("option", { value: p.id, children: p.name }, p.id))) })] }), _jsxs("div", { className: styles.inputGroup, children: [_jsx("label", { children: "Model" }), _jsx("select", { value: profile.modelId, onChange: (e) => updateAgentModel(type, profile.providerId, e.target.value), className: styles.modelSelect, children: provider?.models.map(m => (_jsx("option", { value: m.id, children: m.displayName }, m.id))) })] }), _jsxs("div", { className: styles.sliderGroup, children: [_jsxs("label", { children: ["Temperature ", _jsxs("span", { children: ["(", profile.temperature, ")"] })] }), _jsx("input", { type: "range", min: "0", max: "2", step: "0.1", value: profile.temperature, onChange: (e) => updateAgentParam(type, 'temperature', parseFloat(e.target.value)) })] }), _jsxs("div", { className: styles.inputGroup, children: [_jsx("label", { children: "Max Tokens" }), _jsx("input", { type: "number", value: profile.maxTokens, onChange: (e) => updateAgentParam(type, 'maxTokens', parseInt(e.target.value)), className: styles.keyInput })] }), _jsxs("div", { className: styles.agentActions, children: [_jsx("button", { className: styles.testButton, onClick: () => testAgent(type, profile), disabled: testingAgent === type, children: testingAgent === type ?
                                                                            _jsxs(_Fragment, { children: [_jsx(Loader, { size: 12, className: styles.spin }), " Testing..."] }) :
                                                                            'Test Agent' }), testResults[`agent_${type}`] && (_jsxs("div", { className: `${styles.testStatus} ${testResults[`agent_${type}`].success ? styles.success : styles.error}`, children: [testResults[`agent_${type}`].success ? _jsx(CheckCircle, { size: 14 }) : _jsx(AlertCircle, { size: 14 }), _jsx("span", { children: testResults[`agent_${type}`].message })] }))] })] })] }, type));
                                        }) })] }))] })] }), _jsxs("div", { className: styles.footer, children: [_jsx("button", { className: styles.saveButton, onClick: () => onSave({ ...settings, ai: { ...settings.ai, selectedModels } }), children: "Save Changes" }), !isPage && _jsx("button", { className: styles.cancelButton, onClick: onClose, children: "Cancel" })] })] }));
    if (isPage)
        return panelContent;
    return (_jsx("div", { className: `${styles.overlay} ${className}`, children: panelContent }));
};
export default SettingsPanel;
