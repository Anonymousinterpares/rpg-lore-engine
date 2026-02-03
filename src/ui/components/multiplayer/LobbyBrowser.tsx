import React from 'react';
import styles from './LobbyBrowser.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Users, Lock, Unlock, Globe, RefreshCw, Plus, X } from 'lucide-react';

interface Lobby {
    id: string;
    name: string;
    host: string;
    players: number;
    maxPlayers: number;
    isPrivate: boolean;
    ping: number;
}

interface LobbyBrowserProps {
    lobbies: Lobby[];
    onJoin: (id: string) => void;
    onCreate: () => void;
    onRefresh: () => void;
    onClose: () => void;
    className?: string;
}

const LobbyBrowser: React.FC<LobbyBrowserProps> = ({
    lobbies,
    onJoin,
    onCreate,
    onRefresh,
    onClose,
    className = ''
}) => {
    return (
        <div className={`${styles.overlay} ${className}`}>
            <div className={`${styles.modal} ${parchmentStyles.panel}`}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <Globe size={24} className={styles.icon} />
                        <h2 className={parchmentStyles.heading}>Multiplayer Lobby</h2>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.toolbar}>
                    <button className={`${styles.refreshButton} ${parchmentStyles.button}`} onClick={onRefresh}>
                        <RefreshCw size={16} />
                        <span>Refresh</span>
                    </button>
                    <button className={`${styles.createButton} ${parchmentStyles.button}`} onClick={onCreate}>
                        <Plus size={16} />
                        <span>Host Session</span>
                    </button>
                </div>

                <div className={styles.lobbyList}>
                    <div className={styles.listHeader}>
                        <span className={styles.colName}>Session Name</span>
                        <span className={styles.colHost}>Host</span>
                        <span className={styles.colPlayers}>Players</span>
                        <span className={styles.colPing}>Ping</span>
                        <span className={styles.colAction}></span>
                    </div>

                    <div className={styles.scrollArea}>
                        {lobbies.map(lobby => (
                            <div key={lobby.id} className={styles.lobbyRow}>
                                <div className={styles.sessionName}>
                                    {lobby.isPrivate ? <Lock size={14} className={styles.lockIcon} /> : <Unlock size={14} className={styles.unlockIcon} />}
                                    <span>{lobby.name}</span>
                                </div>
                                <span className={styles.hostName}>{lobby.host}</span>
                                <span className={styles.playerCount}>{lobby.players} / {lobby.maxPlayers}</span>
                                <span className={styles.pingValue}>{lobby.ping}ms</span>
                                <button
                                    className={`${styles.joinButton} ${parchmentStyles.button}`}
                                    onClick={() => onJoin(lobby.id)}
                                    disabled={lobby.players >= lobby.maxPlayers}
                                >
                                    Join
                                </button>
                            </div>
                        ))}

                        {lobbies.length === 0 && (
                            <div className={styles.emptyState}>
                                <Users size={48} opacity={0.2} />
                                <p>No active sessions found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LobbyBrowser;
