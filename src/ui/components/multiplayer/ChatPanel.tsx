import React, { useState, useRef, useEffect } from 'react';
import styles from './ChatPanel.module.css';
import glassStyles from '../../styles/glass.module.css';
import { Send, MessageSquare, User } from 'lucide-react';

interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    timestamp: string;
    isSystem?: boolean;
}

interface ChatPanelProps {
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    className?: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, className = '' }) => {
    const [inputText, setInputText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim()) {
            onSendMessage(inputText.trim());
            setInputText('');
        }
    };

    return (
        <div className={`${styles.container} ${glassStyles.glassPanel} ${className}`}>
            <div className={styles.header}>
                <MessageSquare size={16} className={styles.icon} />
                <h3 className={styles.title}>Party Chat</h3>
            </div>

            <div className={styles.messageList} ref={scrollRef}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`${styles.message} ${msg.isSystem ? styles.system : ''}`}>
                        {!msg.isSystem && (
                            <div className={styles.msgHeader}>
                                <span className={styles.sender}>{msg.sender}</span>
                                <span className={styles.time}>{msg.timestamp}</span>
                            </div>
                        )}
                        <div className={styles.msgBody}>{msg.text}</div>
                    </div>
                ))}
            </div>

            <form className={styles.inputArea} onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Message party..."
                    className={styles.input}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                />
                <button type="submit" className={styles.sendButton}>
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
};

export default ChatPanel;
