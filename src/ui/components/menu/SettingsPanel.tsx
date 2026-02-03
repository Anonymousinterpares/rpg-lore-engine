import React, { useState, useEffect } from 'react';
import styles from './SettingsPanel.module.css';
import glassStyles from '../../styles/glass.module.css';
import { Settings, Volume2, Monitor, Gamepad, X, Cpu, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { LLM_PROVIDERS } from '../../../ruleset/data/StaticData';
import { LLMClient, TestResult } from '../../../ruleset/combat/LLMClient';
import { LLMProviderConfig } from '../../../ruleset/schemas/LLMProviderSchema';

interface SettingsPanelProps {
    onClose: () => void;
    onSave: (settings: any) => void;
    initialSettings: any;
    className?: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, onSave, initialSettings, className = '' }) => {
    const [settings, setSettings] = useState(initialSettings);
    const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'gameplay' | 'ai'>('video');
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
    const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
    const [testingProvider, setTestingProvider] = useState<string | null>(null);

    useEffect(() => {
        const loadKeys = async () => {
            const keys: Record<string, string> = {};
            const models: Record<string, string> = {};

            for (const p of LLM_PROVIDERS) {
                const key = await LLMClient.getApiKey(p);
                if (key) keys[p.id] = key;
                // Default to first model if not set (future: load from settings)
                models[p.id] = p.models[0].id;
            }
            setApiKeys(keys);
            setSelectedModels(models);
        };
        loadKeys();
    }, []);

    const updateApiKey = (id: string, value: string) => {
        setApiKeys({ ...apiKeys, [id]: value });
        LLMClient.setApiKey(id, value);
    };

    const updateModel = (providerId: string, modelId: string) => {
        setSelectedModels({ ...selectedModels, [providerId]: modelId });
    };

    const testProvider = async (provider: LLMProviderConfig) => {
        if (!apiKeys[provider.id]) return;

        setTestingProvider(provider.id);
        setTestResults(prev => ({ ...prev, [provider.id]: { success: false, message: '' } })); // Clear previous result

        const modelConfig = provider.models.find(m => m.id === selectedModels[provider.id]) || provider.models[0];

        try {
            const result = await LLMClient.testConnection(provider, modelConfig);
            setTestResults(prev => ({ ...prev, [provider.id]: result }));
        } finally {
            setTestingProvider(null);
        }
    };

    const handleToggle = (key: string, section: string) => {
        setSettings({
            ...settings,
            [section]: {
                ...settings[section],
                [key]: !settings[section][key]
            }
        });
    };

    const handleSlider = (key: string, section: string, value: number) => {
        setSettings({
            ...settings,
            [section]: {
                ...settings[section],
                [key]: value
            }
        });
    };

    return (
        <div className={`${styles.overlay} ${className}`}>
            <div className={`${styles.modal} ${glassStyles.glassPanel}`}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <Settings size={24} />
                        <h2>System Settings</h2>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.layout}>
                    <div className={styles.sidebar}>
                        <button
                            className={`${styles.tabButton} ${activeTab === 'video' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('video')}
                        >
                            <Monitor size={18} />
                            <span>Video</span>
                        </button>
                        <button
                            className={`${styles.tabButton} ${activeTab === 'audio' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('audio')}
                        >
                            <Volume2 size={18} />
                            <span>Audio</span>
                        </button>
                        <button
                            className={`${styles.tabButton} ${activeTab === 'gameplay' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('gameplay')}
                        >
                            <Gamepad size={18} />
                            <span>Gameplay</span>
                        </button>
                        <button
                            className={`${styles.tabButton} ${activeTab === 'ai' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('ai')}
                        >
                            <Cpu size={18} />
                            <span>AI Service</span>
                        </button>
                    </div>

                    <div className={styles.main}>
                        {activeTab === 'video' && (
                            <div className={styles.section}>
                                <h3>Video Settings</h3>
                                <div className={styles.settingRow}>
                                    <span>Full Screen</span>
                                    <input type="checkbox" checked={settings.video.fullscreen} onChange={() => handleToggle('fullscreen', 'video')} />
                                </div>
                                <div className={styles.settingRow}>
                                    <span>V-Sync</span>
                                    <input type="checkbox" checked={settings.video.vsync} onChange={() => handleToggle('vsync', 'video')} />
                                </div>
                                <div className={styles.settingRow}>
                                    <span>Resolution Scale</span>
                                    <input
                                        type="range" min="0.5" max="2.0" step="0.1"
                                        value={settings.video.resolutionScale}
                                        onChange={(e) => handleSlider('resolutionScale', 'video', parseFloat(e.target.value))}
                                    />
                                    <span>{Math.round(settings.video.resolutionScale * 100)}%</span>
                                </div>
                            </div>
                        )}

                        {activeTab === 'audio' && (
                            <div className={styles.section}>
                                <h3>Audio Settings</h3>
                                <div className={styles.settingRow}>
                                    <span>Master Volume</span>
                                    <input
                                        type="range" min="0" max="1" step="0.1"
                                        value={settings.audio.master}
                                        onChange={(e) => handleSlider('master', 'audio', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className={styles.settingRow}>
                                    <span>Music</span>
                                    <input
                                        type="range" min="0" max="1" step="0.1"
                                        value={settings.audio.music}
                                        onChange={(e) => handleSlider('music', 'audio', parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'gameplay' && (
                            <div className={styles.section}>
                                <h3>Gameplay Settings</h3>
                                <div className={styles.settingRow}>
                                    <span>Difficulty</span>
                                    <select
                                        value={settings.gameplay.difficulty}
                                        onChange={(e) => handleSlider('difficulty', 'gameplay', e.target.value as any)}
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="normal">Normal</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div className={styles.settingRow}>
                                    <span>Tutorial Tips</span>
                                    <input type="checkbox" checked={settings.gameplay.tutorials} onChange={() => handleToggle('tutorials', 'gameplay')} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'ai' && (
                            <div className={styles.section}>
                                <h3>AI Service Configuration</h3>
                                <p className={styles.hint}>Configure your LLM providers. Keys are stored safely in local storage.</p>

                                <div className={styles.providerList}>
                                    {LLM_PROVIDERS.map(provider => (
                                        <div key={provider.id} className={styles.apiBlock}>
                                            <div className={styles.apiHeader}>
                                                <strong>{provider.name}</strong>
                                                <div className={styles.providerMeta}>
                                                    {apiKeys[provider.id] ?
                                                        <span className={styles.keyBadge}>Key Set</span> :
                                                        <span className={styles.keyBadgeMissing}>No Key</span>
                                                    }
                                                </div>
                                            </div>

                                            <div className={styles.inputGroup}>
                                                <label>API Key</label>
                                                <input
                                                    type="password"
                                                    value={apiKeys[provider.id] || ''}
                                                    onChange={(e) => updateApiKey(provider.id, e.target.value)}
                                                    placeholder={`sk-...`}
                                                    className={styles.keyInput}
                                                />
                                            </div>

                                            <div className={styles.inputGroup}>
                                                <label>Model</label>
                                                <select
                                                    value={selectedModels[provider.id] || ''}
                                                    onChange={(e) => updateModel(provider.id, e.target.value)}
                                                    className={styles.modelSelect}
                                                >
                                                    {provider.models.map(m => (
                                                        <option key={m.id} value={m.id}>
                                                            {m.displayName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className={styles.apiActions}>
                                                <button
                                                    className={styles.testButton}
                                                    onClick={() => testProvider(provider)}
                                                    disabled={!apiKeys[provider.id] || testingProvider === provider.id}
                                                >
                                                    {testingProvider === provider.id ?
                                                        <><Loader size={12} className={styles.spin} /> Testing...</> :
                                                        'Test Connection'
                                                    }
                                                </button>

                                                {testResults[provider.id] && (
                                                    <div className={`${styles.testStatus} ${testResults[provider.id].success ? styles.success : styles.error}`}>
                                                        {testResults[provider.id].success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                                        <span>{testResults[provider.id].message}</span>
                                                        {testResults[provider.id].latencyMs && <span className={styles.latency}>({testResults[provider.id].latencyMs}ms)</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.saveButton} onClick={() => onSave({ ...settings, ai: { ...settings.ai, selectedModels } })}>Save Changes</button>
                    <button className={styles.cancelButton} onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
