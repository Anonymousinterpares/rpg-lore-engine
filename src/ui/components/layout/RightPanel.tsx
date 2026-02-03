import React from 'react';
import styles from './RightPanel.module.css';
import terminalStyles from '../../styles/terminal.module.css';
import { Map as MapIcon, MessageSquare } from 'lucide-react';
import parchmentStyles from '../../styles/parchment.module.css';

interface RightPanelProps {
    className?: string;
}

const RightPanel: React.FC<RightPanelProps> = ({ className }) => {
    return (
        <aside className={`${styles.rightPanel} ${parchmentStyles.panel} ${className}`}>
            <div className={styles.section}>
                <h3>World Map</h3>
                <div className={styles.placeholder}>Hex Navigation</div>
            </div>

            <div className={styles.section}>
                <h3>Current Quests</h3>
                <div className={styles.placeholder}>Active Objectives</div>
            </div>
            <div className={`${terminalStyles.panel} ${styles.chatSection}`}>
                <div className={styles.sectionHeader}>
                    <MessageSquare size={18} />
                    <h2>Combat & Chat</h2>
                </div>
                <div className={styles.log}>
                    <div className={terminalStyles.system}>[System] Welcome to the session.</div>
                    <div className={terminalStyles.system}>[System] Game state loaded successfully.</div>
                    <div className={terminalStyles.text}><span className={styles.timestamp}>12:45</span> [Narrator] Roll for initiative!</div>
                    <div className={terminalStyles.text}><span className={styles.timestamp}>12:46</span> [Player] I draw my sword.</div>
                </div>
            </div>
        </aside>
    );
};

export default RightPanel;
