import { GameState } from '../../schemas/FullSaveStateSchema';
import { HexMapManager } from '../HexMapManager';
import { BiomePoolManager } from '../BiomeRegistry';
import { HexGenerator } from '../HexGenerator';
import { Hex } from '../../schemas/HexMapSchema';
import { BiomeType } from '../../schemas/BiomeSchema';
import { InfrastructureManager, InfrastructureType } from '../InfrastructureRules';

/**
 * Handles world exploration, map expansion, and procedural hex generation.
 */
export class ExplorationManager {
    constructor(
        private state: GameState,
        private hexMapManager: HexMapManager,
        private biomePool: BiomePoolManager,
        private emitStateUpdate: () => Promise<void>
    ) { }

    /**
     * Programmatically expands the map discovery around a coordinate.
     * Progressively "uncovers" a hex and reveals its neighbors.
     */
    public async expandHorizon(centerCoords: [number, number]) {
        const centerKey = `${centerCoords[0]},${centerCoords[1]}`;
        const centerHex = this.hexMapManager.getHex(centerKey);

        if (centerHex) {
            const currentName = centerHex.name || '';
            const needsRegen = !centerHex.generated ||
                currentName === 'Uncharted Territory' ||
                currentName.includes('(Unknown)') ||
                currentName.includes('(Uncharted Territory)');

            if (needsRegen) {
                await this.generateAndSaveHex(centerCoords, centerHex, true, true);
            }
        }

        const neighbors = this.hexMapManager.getNeighbors(centerCoords);
        for (const neighbor of neighbors) {
            const nKey = `${neighbor.coordinates[0]},${neighbor.coordinates[1]}`;
            const nHex = this.hexMapManager.getHex(nKey);
            if (nHex) {
                const nName = nHex.name || '';
                if (!nHex.generated || nName === 'Uncharted Territory' || nName.includes('(Unknown)')) {
                    await this.generateAndSaveHex(neighbor.coordinates, nHex, false, true);
                } else if (!nHex.inLineOfSight) {
                    nHex.inLineOfSight = true;
                    await this.hexMapManager.setHex(nHex);
                }
            }
        }

        for (const n of neighbors) {
            await this.hexMapManager.ensureNeighborsRegistered(n.coordinates);
        }

        for (const n of neighbors) {
            const secondLayer = this.hexMapManager.getNeighbors(n.coordinates);
            for (const d2 of secondLayer) {
                const d2Key = `${d2.coordinates[0]},${d2.coordinates[1]}`;
                if (d2Key === centerKey) continue;

                const d2Hex = this.hexMapManager.getHex(d2Key);
                if (d2Hex && !d2Hex.generated) {
                    await this.generateAndSaveHex(d2.coordinates, d2Hex, false, false);
                }
            }
        }
    }

    public seedCoastline(centerCoords: [number, number]) {
        const equations: ('q' | 'q+r' | 'q-r')[] = ['q', 'q+r', 'q-r'];
        const eq = equations[Math.floor(Math.random() * equations.length)];
        const threshold = eq === 'q' ? centerCoords[0] : (eq === 'q+r' ? centerCoords[0] + centerCoords[1] : centerCoords[0] - centerCoords[1]);
        const oceanSide = Math.random() > 0.5 ? 'positive' : 'negative';

        if (!this.state.worldMap.coastlines) {
            this.state.worldMap.coastlines = [];
        }

        this.state.worldMap.coastlines.push({
            id: `coast_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            equation: eq,
            threshold: threshold,
            oceanSide: oceanSide,
            originHex: [...centerCoords]
        });
    }

    public async generateAndSaveHex(coords: [number, number], hex: any, isVisited: boolean, isVisible: boolean) {
        let biome = hex.biome;
        let variant = hex.visualVariant;
        let generatedData: any = {};

        if (!hex.generated) {
            const neighbors = this.hexMapManager.getNeighbors(coords);
            const clusterSizes: Record<BiomeType, number> = {} as any;
            const biomes: BiomeType[] = ['Plains', 'Forest', 'Hills', 'Mountains', 'Swamp', 'Desert', 'Tundra', 'Jungle', 'Coast', 'Ocean', 'Volcanic', 'Ruins', 'Farmland', 'Urban'];

            for (const b of biomes) {
                const neighborWithBiome = neighbors.find(n => n.biome === b);
                clusterSizes[b] = neighborWithBiome ? this.hexMapManager.getClusterSize(neighborWithBiome) : 0;
            }

            const result = HexGenerator.generateHex(coords, neighbors, clusterSizes, this.biomePool, this.state.worldMap.coastlines || []);
            generatedData = result.hex;
            biome = (result.hex as any).biome;
            variant = (result.hex as any).visualVariant;

            if (result.spawnedNPCs && result.spawnedNPCs.length > 0) {
                if (!this.state.worldNpcs) this.state.worldNpcs = [];
                this.state.worldNpcs.push(...result.spawnedNPCs);
            }
        }

        let newName: string;
        if (isVisible && !isVisited) {
            newName = `${biome} (Uncharted Territory)`;
        } else if (isVisited) {
            newName = `${biome} (Discovered)`;
        } else {
            newName = 'Uncharted Territory';
        }

        const updatedHex = {
            ...hex,
            ...generatedData,
            biome,
            visualVariant: variant,
            visited: isVisited,
            generated: true,
            inLineOfSight: isVisible,
            name: newName
        } as Hex;

        // --- Infrastructure Generation (Phase 3) ---
        if (!hex.generated) {
            const neighbors = this.hexMapManager.getNeighbors(coords);
            for (const neighbor of neighbors) {
                const nCoords = neighbor.coordinates;
                const sideIndex = HexMapManager.getSideIndex(coords, nCoords);
                const oppositeSideIndex = HexMapManager.getSideIndex(nCoords, coords);

                if (sideIndex !== -1 && oppositeSideIndex !== -1 && neighbor.generated) {
                    const infraTypes = InfrastructureManager.rollForInfrastructure(biome, neighbor.biome);
                    if (infraTypes.sideA !== 'None' || infraTypes.sideB !== 'None') {
                        const getTypeCode = (t: InfrastructureType): 'R' | 'P' | 'A' | 'D' => {
                            if (t === 'Road') return 'R';
                            if (t === 'Ancient') return 'A';
                            if (t === 'Disappearing') return 'D';
                            return 'P';
                        };

                        const typeCodeA = getTypeCode(infraTypes.sideA);
                        const typeCodeB = getTypeCode(infraTypes.sideB);

                        // Roll for discovery based on biome context
                        const isFindThePathActive = this.state.findThePathActiveUntil > this.state.worldTime.totalTurns;
                        let isAutoDiscoveredA = InfrastructureManager.shouldAutoDiscover(infraTypes.sideA, biome) || isFindThePathActive;
                        let isAutoDiscoveredB = InfrastructureManager.shouldAutoDiscover(infraTypes.sideB, neighbor.biome) || isFindThePathActive;

                        // Continuity Rule: If one side of a connection is discovered, the other should be visible 
                        // to prevent "dead end" rendering artifacts (e.g., Road disappearing into nothingness).
                        if (isAutoDiscoveredA) isAutoDiscoveredB = true;
                        if (isAutoDiscoveredB) isAutoDiscoveredA = true;

                        this.hexMapManager.setConnection(updatedHex, sideIndex, typeCodeA, isAutoDiscoveredA);
                        this.hexMapManager.setConnection(neighbor, oppositeSideIndex, typeCodeB, isAutoDiscoveredB);

                        // Save neighbor update immediately
                        await this.hexMapManager.setHex(neighbor);
                    }
                }
            }
        }

        await this.hexMapManager.setHex(updatedHex);
    }

    /**
     * Survey Area (Phase 5)
     * Permanently sets the DiscoveredFlag to 1 for all connections 
     * in the current hex and its immediate neighbors (radius 1).
     */
    public async surveyArea(centerCoords: [number, number]): Promise<number> {
        let revealedCount = 0;
        const targets = [
            centerCoords,
            ...this.hexMapManager.getNeighbors(centerCoords).map(n => n.coordinates)
        ];

        for (const coords of targets) {
            const hex = this.hexMapManager.getHex(`${coords[0]},${coords[1]}`);
            if (!hex || !hex.connections) continue;

            const connections = hex.connections.split(',');
            let changed = false;
            const updated = connections.map(entry => {
                const [side, type, disco] = entry.split(':');
                if (disco === '0') {
                    revealedCount++;
                    changed = true;
                    return `${side}:${type}:1`;
                }
                return entry;
            });

            if (changed) {
                hex.connections = updated.join(',');
                await this.hexMapManager.setHex(hex);
            }
        }

        return revealedCount;
    }
}
