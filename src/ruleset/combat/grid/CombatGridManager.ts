import { CombatGrid, GridPosition, TerrainFeature, Combatant } from '../schemas/CombatSchema';

export class CombatGridManager {
    private grid: CombatGrid;

    constructor(grid: CombatGrid) {
        this.grid = grid;
    }

    /**
     * Checks if a position is within grid bounds.
     */
    public isWithinBounds(pos: GridPosition): boolean {
        return pos.x >= 0 && pos.x < this.grid.width && pos.y >= 0 && pos.y < this.grid.height;
    }

    /**
     * Checks if a cell is blocked by terrain or has blocking features.
     */
    public isWalkable(pos: GridPosition, occupants: Combatant[] = []): boolean {
        if (!this.isWithinBounds(pos)) return false;

        // Check for terrain features
        const feature = this.getFeatureAt(pos);
        if (feature && feature.blocksMovement) return false;

        // Check for other occupants (if they block movement - standard D&D: can't end turn in occupied cell)
        // Usually, moving THROUGH allies is fine (difficult terrain), but enemies block.
        // For simplicity here: absolute occupancy check for "walkable" target validation.
        const occupant = occupants.find(c => c.position.x === pos.x && c.position.y === pos.y && c.hp.current > 0);
        if (occupant) return false;

        return true;
    }

    /**
     * Gets terrain feature at specific coordinates.
     */
    public getFeatureAt(pos: GridPosition): TerrainFeature | undefined {
        return this.grid.features.find(f => f.position.x === pos.x && f.position.y === pos.y);
    }

    /**
     * Bresenham's Line Algorithm to check Line of Sight between two points.
     */
    public hasLineOfSight(start: GridPosition, end: GridPosition): boolean {
        let x0 = start.x;
        let y0 = start.y;
        let x1 = end.x;
        let y1 = end.y;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            if (x0 === x1 && y0 === y1) break;

            // Check if current cell (other than start/end centers) blocks vision
            if (!(x0 === start.x && y0 === start.y) && !(x0 === end.x && y0 === end.y)) {
                const feature = this.getFeatureAt({ x: x0, y: y0 });
                if (feature && feature.blocksVision) return false;
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }

        return true;
    }

    /**
     * Calculates distance between two points using Chebyshev distance (D&D 5e: diagonals cost same as straight).
     */
    public getDistance(a: GridPosition, b: GridPosition): number {
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    }

    /**
     * Determines cover level between observer and target.
     * Simple implementation: raycast and count features with cover values.
     */
    public getCover(observer: GridPosition, target: GridPosition): 'None' | 'Half' | 'Three-Quarters' | 'Full' {
        if (!this.hasLineOfSight(observer, target)) return 'Full';

        let coverBonusCount = 0;
        let x0 = observer.x;
        let y0 = observer.y;
        let x1 = target.x;
        let y1 = target.y;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            if (x0 === x1 && y0 === y1) break;

            const feature = this.getFeatureAt({ x: x0, y: y0 });
            if (feature) {
                if (feature.coverBonus === 'FULL') return 'Full';
                if (feature.coverBonus === 'THREE_QUARTERS') coverBonusCount += 2;
                if (feature.coverBonus === 'HALF') coverBonusCount += 1;
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }

        if (coverBonusCount >= 2) return 'Three-Quarters';
        if (coverBonusCount >= 1) return 'Half';
        return 'None';
    }

    /**
     * A* Pathfinding to find the shortest path between two points.
     */
    public findPath(start: GridPosition, end: GridPosition, occupants: Combatant[] = []): GridPosition[] | null {
        const openSet: Node[] = [];
        const closedSet: Set<string> = new Set();

        const startNode = new Node(start, null, 0, this.getDistance(start, end));
        openSet.push(startNode);

        while (openSet.length > 0) {
            // Get node with lowest f cost
            let currentIdx = 0;
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < openSet[currentIdx].f) currentIdx = i;
            }
            const current = openSet.splice(currentIdx, 1)[0];

            if (current.pos.x === end.x && current.pos.y === end.y) {
                return this.reconstructPath(current);
            }

            closedSet.add(`${current.pos.x},${current.pos.y}`);

            // Check neighbors (including diagonals)
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;

                    const neighborPos: GridPosition = { x: current.pos.x + dx, y: current.pos.y + dy };

                    if (!this.isWalkable(neighborPos, occupants) && !(neighborPos.x === end.x && neighborPos.y === end.y)) continue;
                    if (closedSet.has(`${neighborPos.x},${neighborPos.y}`)) continue;

                    const gCost = current.g + 1; // Diagonal cost is 1 in D&D spatial grid (standard)
                    const hCost = this.getDistance(neighborPos, end);
                    const neighborNode = new Node(neighborPos, current, gCost, hCost);

                    const existingOpen = openSet.find(n => n.pos.x === neighborPos.x && n.pos.y === neighborPos.y);
                    if (existingOpen) {
                        if (gCost < existingOpen.g) {
                            existingOpen.g = gCost;
                            existingOpen.f = gCost + existingOpen.h;
                            existingOpen.parent = current;
                        }
                    } else {
                        openSet.push(neighborNode);
                    }
                }
            }
        }

        return null;
    }

    private reconstructPath(node: Node): GridPosition[] {
        const path: GridPosition[] = [];
        let current: Node | null = node;
        while (current) {
            path.unshift(current.pos);
            current = current.parent;
        }
        return path;
    }
}

class Node {
    g: number; // Cost from start
    h: number; // Heuristic cost to end
    f: number; // Total cost
    pos: GridPosition;
    parent: Node | null;

    constructor(pos: GridPosition, parent: Node | null, g: number, h: number) {
        this.pos = pos;
        this.parent = parent;
        this.g = g;
        this.h = h;
        this.f = g + h;
    }
}
