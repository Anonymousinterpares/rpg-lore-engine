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
    if (state.location.travelAnimation && t > 0.5) {
        activeCoords = state.location.travelAnimation.targetCoordinates;
    } else {
        activeCoords = state.location.coordinates;
    }

    const activeHexKey = `${activeCoords[0]},${activeCoords[1]}`;
    const activeHex = state.worldMap.hexes[activeHexKey];
    const biome = activeHex?.biome || 'Unknown';
    const biomeDef = BIOME_DEFINITIONS.find(b => b.id === biome);

    // Calculate Speed Modifiers
    const biomeMod = biomeDef?.travelSpeedModifier || 1.0;
    const paceMod = state.travelPace === 'Fast' ? 1.33 : (state.travelPace === 'Slow' ? 0.66 : 1.0);
    const stanceMod = state.travelStance === 'Stealth' ? 0.6 : 1.0;

    const baseTime = 4 * 60; // 4 hours in minutes
    const finalTime = Math.round((baseTime / biomeMod) / paceMod / stanceMod);

    return (
        <div className={styles.container}>
            <div className={styles.header}>DIAGNOSTICS</div>
            <div className={styles.row}>
                <span className={styles.label}>Coords:</span>
                <span className={styles.value}>[{activeCoords[0]}, {activeCoords[1]}]</span>
            </div>
            <div className={styles.row}>
                <span className={styles.label}>Biome:</span>
                <span className={styles.value}>{biome}</span>
            </div>
            <hr className={styles.divider} />
            <div className={styles.row}>
                <span className={styles.label}>Biome Mod:</span>
                <span className={styles.value}>x{biomeMod.toFixed(2)}</span>
            </div>
            <div className={styles.row}>
                <span className={styles.label}>Pace ({state.travelPace}):</span>
                <span className={styles.value}>x{paceMod.toFixed(2)}</span>
            </div>
            <div className={styles.row}>
                <span className={styles.label}>Stance ({state.travelStance}):</span>
                <span className={styles.value}>x{stanceMod.toFixed(2)}</span>
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
        </div>
    );
};

export default DevOverlay;
