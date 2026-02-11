import { GameState } from '../../ruleset/combat/GameStateManager';
import { Hex } from '../../ruleset/schemas/HexMapSchema';

export class SnapshotService {
    /**
     * Renders a simplified map to a data URL for save thumbnails.
     */
    public static captureMapSnapshot(state: GameState): string {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        // Fill background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const hexEntries = Object.entries(state.worldMap.hexes);
        if (hexEntries.length === 0) return canvas.toDataURL();

        const currentHex = state.worldMap.hexes[state.location.hexId];
        const centerQ = currentHex ? currentHex.coordinates[0] : 0;
        const centerR = currentHex ? currentHex.coordinates[1] : 0;

        const size = 10; // Mini hex size

        // Simple flat-top hex renderer
        const drawHex = (q: number, r: number, color: string, isCurrent: boolean) => {
            const x = 60 + size * (3 / 2 * (q - centerQ));
            const y = 60 - size * (Math.sqrt(3) / 2 * (q - centerQ) + Math.sqrt(3) * (r - centerR));

            // Basic bounding box check for optimization/clipping
            if (x < -size || x > 120 + size || y < -size || y > 120 + size) return;

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = i * Math.PI / 3;
                const px = x + size * Math.cos(angle);
                const py = y + size * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            if (isCurrent) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        };

        // Render discovered/visited hexes
        hexEntries.forEach(([id, hex]: [string, Hex]) => {
            if (!hex.visited && !hex.inLineOfSight) return;

            let color = '#3d4037'; // Default
            const biome = hex.biome.toLowerCase();
            if (biome === 'forest') color = '#2d5a27';
            else if (biome === 'mountains') color = '#4a4a4a';
            else if (biome === 'ocean' || biome === 'coast') color = '#1a3a5a';
            else if (biome === 'plains') color = '#4a5a2a';
            else if (biome === 'swamp') color = '#2a3a1a';
            else if (biome === 'desert') color = '#7a6a3a';
            else if (biome === 'tundra') color = '#a0a0a0';
            else if (biome === 'jungle') color = '#1a4a1a';

            drawHex(hex.coordinates[0], hex.coordinates[1], color, state.location.hexId === id);
        });

        return canvas.toDataURL('image/png');
    }
}
