import React from 'react';
import glassStyles from '../../styles/glass.module.css';
import styles from './RightPanel.module.css';
import terminalStyles from '../../styles/terminal.module.css';
import { Map as MapIcon, MessageSquare } from 'lucide-react';

interface RightPanelProps {
    className?: string;
}

const RightPanel: React.FC<RightPanelProps> = ({ className }) => {
    return (
        <aside className={`${styles.container} ${className}`}>
            <div className={`${glassStyles.panel} ${styles.mapSection}`}>
                <div className={styles.sectionHeader}>
                    <MapIcon size={18} />
                    <h2>Hex Map</h2>
                </div>
                <div className={styles.mapPlaceholder}>Map Simulation Placeholder</div>
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
