import React, { useState, useEffect } from 'react';
import styles from './DevOverlay.module.css';
import { GameState } from '../../../ruleset/schemas/FullSaveStateSchema';
import { BIOME_DEFINITIONS } from '../../../ruleset/data/StaticData';
import { HexMapManager } from '../../../ruleset/combat/HexMapManager';

interface DevOverlayProps {
    state: GameState;
}

const DevOverlay: React.FC<DevOverlayProps> = ({ state }) => {
    const [renderTrigger, setRenderTrigger] = useState(0);

    // Force re-render during animation to update the `t` calculation
    useEffect(() => {
        if (!state.location.travelAnimation) return;

        let rafId: number;
        const step = () => {
            setRenderTrigger(prev => prev + 1);
            rafId = requestAnimationFrame(step);
        };
        rafId = requestAnimationFrame(step);

        return () => cancelAnimationFrame(rafId);
    }, [state.location.travelAnimation]);

    if (!state.settings.gameplay.developerMode) return null;

    // Calculate animation progress (t)
    const getAnimationProgress = (): number => {
        if (!state.location.travelAnimation) return 0;
        const { startTime, duration } = state.location.travelAnimation;
        const elapsed = Date.now() - startTime;
        return Math.min(1, Math.max(0, elapsed / duration));
    };

    const t = getAnimationProgress();

    // Determine active coordinates: switch to target when t > 0.5 (visually crossed)
    let activeCoords: [number, number];
    let activeTravelType: string | undefined;
    if (state.location.travelAnimation && t > 0.5) {
        activeCoords = state.location.travelAnimation.targetCoordinates;
        activeTravelType = state.location.travelAnimation.travelType;
    } else {
        activeCoords = state.location.coordinates;
        if (state.location.travelAnimation) {
            activeTravelType = state.location.travelAnimation.travelType;
        }
    }

    const activeHexKey = `${activeCoords[0]},${activeCoords[1]}`;
    const activeHex = state.worldMap.hexes[activeHexKey];
    const biome = activeHex?.biome || 'Unknown';
    const biomeDef = BIOME_DEFINITIONS.find(b => b.id === biome);

    // Infrastructure Detection
    let infraMod = 1.0;
    let infraName = 'None';

    if (state.location.travelAnimation) {
        // Use actual travel type from animation state
        const type = state.location.travelAnimation.travelType;
        if (type === 'Road') {
            infraMod = 0.5;
            infraName = 'Road';
        } else if (type === 'Path') {
            infraMod = 0.75;
            infraName = 'Path';
        } else {
            infraName = type || 'Wilderness';
        }
    } else if (activeHex?.connections) {
        // Static detection: check for ANY discovered connections in the hex
        const discovered = activeHex.connections.split(',').map(c => c.split(':')).filter(c => c[2] === '1');
        if (discovered.some(c => c[1] === 'R')) {
            infraName = 'Road Access';
            infraMod = 0.5; // Show potential best speed
        } else if (discovered.some(c => c[1] === 'P')) {
            infraName = 'Path Access';
            infraMod = 0.75;
        }
    }

    // Calculate Speed Modifiers
    const biomeMod = biomeDef?.travelSpeedModifier || 1.0;
    const paceMod = state.travelPace === 'Forced March' ? 1.33 : (state.travelPace === 'Cautious' || state.travelPace === 'Stealth' ? 0.66 : 1.0);

    const baseTime = 4 * 60; // 4 hours in minutes
    const finalTime = Math.round((baseTime / biomeMod) / paceMod * infraMod);

    return (
        <div className={styles.container}>
            <div className={styles.header}>DIAGNOSTICS</div>
            <div className={styles.row}>
                <span className={styles.label}>Coords:</span>
                <span className={styles.value}>[{activeCoords[0]}, {activeCoords[1]}]</span>
            </div>
            <div className={styles.row}>
                <span className={styles.label}>Biome:</span>
                <span className={styles.value}>{biome} (x{biomeMod.toFixed(1)})</span>
            </div>
            <div className={styles.row}>
                <span className={styles.label}>Infra:</span>
                <span className={styles.value}>{infraName} {infraMod < 1.0 ? `(x${infraMod.toFixed(2)})` : ''}</span>
            </div>
            <hr className={styles.divider} />
            <div className={styles.row}>
                <span className={styles.label}>Mode ({state.travelPace}):</span>
                <span className={styles.value}>x{paceMod.toFixed(2)}</span>
            </div>
            <hr className={styles.divider} />
            <div className={styles.row}>
                <span className={styles.label}>Est. Travel Time:</span>
                <span className={styles.total}>{Math.round(finalTime)} min ({(finalTime / 60).toFixed(1)}h)</span>
            </div>
            {state.location.travelAnimation && (
                <div className={styles.animating}>
                    ANIMATING [{(t * 100).toFixed(0)}%]
                </div>
            )}

            <hr className={styles.divider} />
            <div className={styles.logHeader}>System Log</div>
            <div className={styles.debugLog}>
                {(state.debugLog || []).map((msg, idx) => (
                    <div key={idx} className={styles.logEntry}>{msg}</div>
                ))}
            </div>
        </div>
    );
};

export default DevOverlay;
