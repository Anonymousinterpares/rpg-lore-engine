import React from 'react';
import styles from './DevOverlay.module.css';
import { GameState } from '../../../ruleset/schemas/FullSaveStateSchema';
import { BIOME_DEFINITIONS } from '../../../ruleset/data/StaticData';
import { HexMapManager } from '../../../ruleset/combat/HexMapManager';

interface DevOverlayProps {
    state: GameState;
}

const DevOverlay: React.FC<DevOverlayProps> = ({ state }) => {
    if (!state.settings.gameplay.developerMode) return null;

    const currentCoords = state.location.coordinates;
    const currentHexKey = `${currentCoords[0]},${currentCoords[1]}`;

    // We can't easily access the full registry from here without a manager instance, 
    // but the state has the worldMap.hexes registry.
    const currentHex = state.worldMap.hexes[currentHexKey];
    const biome = currentHex?.biome || 'Unknown';
    const biomeDef = BIOME_DEFINITIONS.find(b => b.id === biome);

    // Calculate Speed Modifiers
    const biomeMod = biomeDef?.travelSpeedModifier || 1.0;
    const paceMod = state.travelPace === 'Fast' ? 1.33 : (state.travelPace === 'Slow' ? 0.66 : 1.0);
    const stanceMod = state.travelStance === 'Stealth' ? 0.6 : 1.0;

    // Infrastructure check (approximate from state)
    // In a real scenario we'd use HexMapManager, but we can parse the connections string manually if it exists
    let infraMod = 1.0;
    let infraType = 'None';

    // If we're currently moving, we don't have the easy 'connection' lookup here without the destination,
    // so we show the "Passive" speed of the current hex.

    const baseTime = 4 * 60; // 4 hours
    const finalTime = Math.round((baseTime / biomeMod) * (1 / (state.travelPace === 'Fast' ? 1.33 : (state.travelPace === 'Slow' ? 0.66 : 1.0))));

    return (
        <div className={styles.container}>
            <div className={styles.header}>DIAGNOSTICS</div>
            <div className={styles.row}>
                <span className={styles.label}>Coords:</span>
                <span className={styles.value}>[{currentCoords[0]}, {currentCoords[1]}]</span>
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
                    ANIMATING MOVEMENT...
                </div>
            )}
        </div>
    );
};

export default DevOverlay;
