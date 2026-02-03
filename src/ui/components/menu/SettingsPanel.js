import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './SettingsPanel.module.css';
import glassStyles from '../../styles/glass.module.css';
import { Settings, Volume2, Monitor, Gamepad, X } from 'lucide-react';
const SettingsPanel = ({ onClose, onSave, initialSettings, className = '' }) => {
    const [settings, setSettings] = useState(initialSettings);
    const [activeTab, setActiveTab] = useState('video');
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
    return (_jsx("div", { className: `${styles.overlay} ${className}`, children: _jsxs("div", { className: `${styles.modal} ${glassStyles.glassPanel}`, children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.headerTitle, children: [_jsx(Settings, { size: 24 }), _jsx("h2", { children: "System Settings" })] }), _jsx("button", { className: styles.closeButton, onClick: onClose, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: styles.layout, children: [_jsxs("div", { className: styles.sidebar, children: [_jsxs("button", { className: `${styles.tabButton} ${activeTab === 'video' ? styles.activeTab : ''}`, onClick: () => setActiveTab('video'), children: [_jsx(Monitor, { size: 18 }), _jsx("span", { children: "Video" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'audio' ? styles.activeTab : ''}`, onClick: () => setActiveTab('audio'), children: [_jsx(Volume2, { size: 18 }), _jsx("span", { children: "Audio" })] }), _jsxs("button", { className: `${styles.tabButton} ${activeTab === 'gameplay' ? styles.activeTab : ''}`, onClick: () => setActiveTab('gameplay'), children: [_jsx(Gamepad, { size: 18 }), _jsx("span", { children: "Gameplay" })] })] }), _jsxs("div", { className: styles.main, children: [activeTab === 'video' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Video Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Full Screen" }), _jsx("input", { type: "checkbox", checked: settings.video.fullscreen, onChange: () => handleToggle('fullscreen', 'video') })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "V-Sync" }), _jsx("input", { type: "checkbox", checked: settings.video.vsync, onChange: () => handleToggle('vsync', 'video') })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Resolution Scale" }), _jsx("input", { type: "range", min: "0.5", max: "2.0", step: "0.1", value: settings.video.resolutionScale, onChange: (e) => handleSlider('resolutionScale', 'video', parseFloat(e.target.value)) }), _jsxs("span", { children: [Math.round(settings.video.resolutionScale * 100), "%"] })] })] })), activeTab === 'audio' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Audio Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Master Volume" }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: settings.audio.master, onChange: (e) => handleSlider('master', 'audio', parseFloat(e.target.value)) })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Music" }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.1", value: settings.audio.music, onChange: (e) => handleSlider('music', 'audio', parseFloat(e.target.value)) })] })] })), activeTab === 'gameplay' && (_jsxs("div", { className: styles.section, children: [_jsx("h3", { children: "Gameplay Settings" }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Difficulty" }), _jsxs("select", { value: settings.gameplay.difficulty, onChange: (e) => handleSlider('difficulty', 'gameplay', e.target.value), children: [_jsx("option", { value: "easy", children: "Easy" }), _jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "hard", children: "Hard" })] })] }), _jsxs("div", { className: styles.settingRow, children: [_jsx("span", { children: "Tutorial Tips" }), _jsx("input", { type: "checkbox", checked: settings.gameplay.tutorials, onChange: () => handleToggle('tutorials', 'gameplay') })] })] }))] })] }), _jsxs("div", { className: styles.footer, children: [_jsx("button", { className: styles.saveButton, onClick: () => onSave(settings), children: "Save Changes" }), _jsx("button", { className: styles.cancelButton, onClick: onClose, children: "Cancel" })] })] }) }));
};
export default SettingsPanel;
