import React, { useRef, useEffect } from 'react';
import styles from './CombatLog.module.css';
import terminalStyles from '../../styles/terminal.module.css';

interface LogEntry {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    turn?: number;
}

interface CombatLogProps {
    logs: LogEntry[];
    className?: string;
}

const CombatLog: React.FC<CombatLogProps> = ({ logs, className = '' }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getTypeClass = (type: string) => {
        switch (type) {
            case 'warning': return terminalStyles.warning;
            case 'error': return terminalStyles.error;
            case 'info': return terminalStyles.info;
            case 'success': return styles.success;
            default: return '';
        }
    };

    return (
        <div className={`${styles.container} ${terminalStyles.panel} ${className}`}>
            <div className={styles.header}>Combat Log</div>
            <div className={styles.scrollArea} ref={scrollRef}>
                {logs.map((log) => (
                    <div key={log.id} className={`${styles.entry} ${getTypeClass(log.type)}`}>
                        {log.turn !== undefined && <span className={styles.turn}>[T{log.turn}]</span>}
                        <span className={styles.message}>{log.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CombatLog;
