/**
 * Deterministic Random Number Generator
 * Uses Mulberry32 algorithm for reproducible results
 * 
 * Given the same seed, will always produce the same sequence of numbers
 */
export interface Rng {
    /** Returns a float between 0 (inclusive) and 1 (exclusive) */
    next(): number;
    /** Returns an integer between min and max (inclusive) */
    nextInt(min: number, max: number): number;
    /** Returns true with the given probability (0-100) */
    chance(percent: number): boolean;
    /** Picks a random element from an array */
    pick<T>(array: T[]): T;
    /** Shuffles an array in place */
    shuffle<T>(array: T[]): T[];
}

/**
 * Creates a new deterministic RNG using the Mulberry32 algorithm
 * @param seed - Initial seed value (will be converted to 32-bit integer)
 */
export function createRng(seed: number): Rng {
    // Ensure seed is a 32-bit integer
    let state = seed >>> 0;

    function next(): number {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function nextInt(min: number, max: number): number {
        return Math.floor(next() * (max - min + 1)) + min;
    }

    function chance(percent: number): boolean {
        return next() * 100 < percent;
    }

    function pick<T>(array: T[]): T {
        if (array.length === 0) {
            throw new Error('Cannot pick from empty array');
        }
        return array[nextInt(0, array.length - 1)];
    }

    function shuffle<T>(array: T[]): T[] {
        // Fisher-Yates shuffle
        for (let i = array.length - 1; i > 0; i--) {
            const j = nextInt(0, i);
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    return { next, nextInt, chance, pick, shuffle };
}

/**
 * Creates a seed from a match setup for deterministic replay
 */
export function createMatchSeed(matchId: string, timestamp: number): number {
    // Simple hash combining matchId and timestamp
    let hash = timestamp;
    for (let i = 0; i < matchId.length; i++) {
        hash = ((hash << 5) - hash + matchId.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
}
