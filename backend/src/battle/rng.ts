/**
 * Deterministic RNG using xorshift32 algorithm
 * Same seed always produces the same sequence of random numbers
 */
export class DeterministicRNG {
    private state: number;

    constructor(seed: string) {
        // Convert hex seed to uint32
        this.state = parseInt(seed.substring(0, 8), 16) >>> 0;
        if (this.state === 0) this.state = 1; // Prevent zero state
    }

    /**
     * Generate next random number using xorshift32
     * Returns value in [0, 1)
     */
    next(): number {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x >>> 0;
        return (this.state >>> 0) / 4294967296;
    }

    /**
     * Random float in range [min, max)
     */
    range(min: number, max: number): number {
        return min + (max - min) * this.next();
    }

    /**
     * Random integer in range [min, max] (inclusive)
     */
    int(min: number, max: number): number {
        return Math.floor(this.range(min, max + 1));
    }

    /**
     * Returns true with given probability (0-1)
     */
    chance(probability: number): boolean {
        return this.next() < probability;
    }

    /**
     * Pick random element from array
     */
    pick<T>(array: T[]): T {
        return array[this.int(0, array.length - 1)];
    }

    /**
     * Shuffle array in place (Fisher-Yates)
     */
    shuffle<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    /**
     * Get current state (for debugging/logging)
     */
    getState(): number {
        return this.state;
    }
}

/**
 * Create battle seed from multiple sources
 */
export function createBattleSeed(
    serverSeed: string,
    playerASeed: string,
    playerBSeed: string
): string {
    // Simple concatenation + hash would be ideal, but for now just concat
    // In production, use crypto.subtle.digest('SHA-256', ...)
    const combined = `${serverSeed}|${playerASeed}|${playerBSeed}`;

    // Simple hash for now (replace with proper SHA-256 in production)
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
}
