import * as React from 'react';
import { useRef, useEffect } from 'react';
import styles from './CombatLog.module.css';
import terminalStyles from '../../styles/terminal.module.css';

import { CombatLogEntry } from '../../../ruleset/schemas/CombatSchema';

// interface LogEntry { ... } // Replaced by import

interface CombatLogProps {
    logs: CombatLogEntry[];
    className?: string;
}

const CombatLog: React.FC<CombatLogProps> = ({ logs, className = '' }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    };

    useEffect(() => {
        scrollToBottom();
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
            <div className={styles.scrollArea}>
                {logs.map((log) => (
                    <div key={log.id} className={`${styles.entry} ${getTypeClass(log.type)}`}>
                        {log.turn !== undefined && <span className={styles.turn}>[T{log.turn}]</span>}
                        <span className={styles.message}>
                            {log.message}
                            {(log as any).details?.rollDetails?.modifiers && (
                                <span className={styles.rollDetail} title="Roll Breakdown">
                                    {' '}(
                                    {(log as any).details.rollDetails.modifiers.map((m: any, i: number) =>
                                        `${i > 0 ? ', ' : ''}${m.label}: ${m.value >= 0 ? '+' : ''}${m.value}`
                                    ).join('')}
                                    )
                                </span>
                            )}
                        </span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};

export default CombatLog;
