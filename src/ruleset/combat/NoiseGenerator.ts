/**
 * Simple 2D Noise Generator
 * Based on a simplified Value Noise or Perlin-like approach for deterministic biome generation.
 */
export class NoiseGenerator {
    private perm: number[] = [];

    constructor(seed: number) {
        this.perm = new Array(512);
        const p = new Array(256).fill(0).map((_, i) => i);

        // Fisher-Yates shuffle with seed
        let m = 256, t, i;
        while (m) {
            i = Math.floor(this.pseudoRandom(seed + m) * m--);
            t = p[m];
            p[m] = p[i];
            p[i] = t;
        }

        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
        }
    }

    private pseudoRandom(seed: number): number {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    private grad(hash: number, x: number, y: number): number {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    public noise(x: number, y: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const A = this.perm[X] + Y;
        const B = this.perm[X + 1] + Y;

        return this.lerp(v,
            this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
            this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
        );
    }

    /**
     * Generates fractional Brownian motion (fBm) noise
     * @param x X coordinate
     * @param y Y coordinate
     * @param octaves Number of layers
     * @param persistence Amplitude decay
     * @param lacunarity Frequency growth
     */
    public fbm(x: number, y: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;  // Used for normalizing result to 0.0 - 1.0

        for (let i = 0; i < octaves; i++) {
            total += this.noise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        // Normalize to [0, 1] range (approximate, since noise is [-1, 1])
        return (total / maxValue) + 0.5;
    }
}
