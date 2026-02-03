import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import styles from './ChatPanel.module.css';
import glassStyles from '../../styles/glass.module.css';
import { Send, MessageSquare } from 'lucide-react';
const ChatPanel = ({ messages, onSendMessage, className = '' }) => {
    const [inputText, setInputText] = useState('');
    const scrollRef = useRef(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputText.trim()) {
            onSendMessage(inputText.trim());
            setInputText('');
        }
    };
    return (_jsxs("div", { className: `${styles.container} ${glassStyles.glassPanel} ${className}`, children: [_jsxs("div", { className: styles.header, children: [_jsx(MessageSquare, { size: 16, className: styles.icon }), _jsx("h3", { className: styles.title, children: "Party Chat" })] }), _jsx("div", { className: styles.messageList, ref: scrollRef, children: messages.map((msg) => (_jsxs("div", { className: `${styles.message} ${msg.isSystem ? styles.system : ''}`, children: [!msg.isSystem && (_jsxs("div", { className: styles.msgHeader, children: [_jsx("span", { className: styles.sender, children: msg.sender }), _jsx("span", { className: styles.time, children: msg.timestamp })] })), _jsx("div", { className: styles.msgBody, children: msg.text })] }, msg.id))) }), _jsxs("form", { className: styles.inputArea, onSubmit: handleSubmit, children: [_jsx("input", { type: "text", placeholder: "Message party...", className: styles.input, value: inputText, onChange: (e) => setInputText(e.target.value) }), _jsx("button", { type: "submit", className: styles.sendButton, children: _jsx(Send, { size: 16 }) })] })] }));
};
export default ChatPanel;
