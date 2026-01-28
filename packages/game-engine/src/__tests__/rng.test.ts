import { createRng, createMatchSeed } from '../rng.js';

describe('Deterministic RNG', () => {
    describe('createRng', () => {
        it('should produce consistent results with the same seed', () => {
            const rng1 = createRng(12345);
            const rng2 = createRng(12345);

            const sequence1 = Array.from({ length: 10 }, () => rng1.next());
            const sequence2 = Array.from({ length: 10 }, () => rng2.next());

            expect(sequence1).toEqual(sequence2);
        });

        it('should produce different results with different seeds', () => {
            const rng1 = createRng(12345);
            const rng2 = createRng(54321);

            const val1 = rng1.next();
            const val2 = rng2.next();

            expect(val1).not.toEqual(val2);
        });

        it('should produce values between 0 and 1', () => {
            const rng = createRng(99999);

            for (let i = 0; i < 1000; i++) {
                const val = rng.next();
                expect(val).toBeGreaterThanOrEqual(0);
                expect(val).toBeLessThan(1);
            }
        });
    });

    describe('nextInt', () => {
        it('should produce integers within the specified range', () => {
            const rng = createRng(42);

            for (let i = 0; i < 100; i++) {
                const val = rng.nextInt(1, 10);
                expect(val).toBeGreaterThanOrEqual(1);
                expect(val).toBeLessThanOrEqual(10);
                expect(Number.isInteger(val)).toBe(true);
            }
        });

        it('should be deterministic for nextInt', () => {
            const rng1 = createRng(777);
            const rng2 = createRng(777);

            const seq1 = Array.from({ length: 20 }, () => rng1.nextInt(-5, 5));
            const seq2 = Array.from({ length: 20 }, () => rng2.nextInt(-5, 5));

            expect(seq1).toEqual(seq2);
        });
    });

    describe('chance', () => {
        it('should return true roughly according to probability', () => {
            const rng = createRng(123);
            let trueCount = 0;
            const trials = 10000;

            for (let i = 0; i < trials; i++) {
                if (rng.chance(50)) trueCount++;
            }

            // Should be roughly 50% (within 5% tolerance)
            const ratio = trueCount / trials;
            expect(ratio).toBeGreaterThan(0.45);
            expect(ratio).toBeLessThan(0.55);
        });

        it('should always return true for 100%', () => {
            const rng = createRng(456);
            for (let i = 0; i < 100; i++) {
                expect(rng.chance(100)).toBe(true);
            }
        });

        it('should always return false for 0%', () => {
            const rng = createRng(789);
            for (let i = 0; i < 100; i++) {
                expect(rng.chance(0)).toBe(false);
            }
        });
    });

    describe('pick', () => {
        it('should pick elements from an array', () => {
            const rng = createRng(111);
            const options = ['a', 'b', 'c', 'd', 'e'];

            for (let i = 0; i < 50; i++) {
                const picked = rng.pick(options);
                expect(options).toContain(picked);
            }
        });

        it('should throw for empty array', () => {
            const rng = createRng(222);
            expect(() => rng.pick([])).toThrow('Cannot pick from empty array');
        });

        it('should be deterministic', () => {
            const rng1 = createRng(333);
            const rng2 = createRng(333);
            const options = [1, 2, 3, 4, 5];

            const seq1 = Array.from({ length: 10 }, () => rng1.pick(options));
            const seq2 = Array.from({ length: 10 }, () => rng2.pick(options));

            expect(seq1).toEqual(seq2);
        });
    });

    describe('shuffle', () => {
        it('should shuffle array in place', () => {
            const rng = createRng(444);
            const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const toShuffle = [...original];

            rng.shuffle(toShuffle);

            // Should contain same elements
            expect(toShuffle.sort()).toEqual(original.sort());
        });

        it('should produce different order than original (usually)', () => {
            const rng = createRng(555);
            const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            const shuffled = [...original];

            rng.shuffle(shuffled);

            // Very unlikely to be exactly the same
            expect(shuffled).not.toEqual(original);
        });

        it('should be deterministic', () => {
            const rng1 = createRng(666);
            const rng2 = createRng(666);
            const arr1 = [1, 2, 3, 4, 5];
            const arr2 = [1, 2, 3, 4, 5];

            rng1.shuffle(arr1);
            rng2.shuffle(arr2);

            expect(arr1).toEqual(arr2);
        });
    });

    describe('createMatchSeed', () => {
        it('should create consistent seeds for same input', () => {
            const seed1 = createMatchSeed('match-123', 1705770000000);
            const seed2 = createMatchSeed('match-123', 1705770000000);

            expect(seed1).toEqual(seed2);
        });

        it('should create different seeds for different matchIds', () => {
            const seed1 = createMatchSeed('match-123', 1705770000000);
            const seed2 = createMatchSeed('match-456', 1705770000000);

            expect(seed1).not.toEqual(seed2);
        });

        it('should create different seeds for different timestamps', () => {
            const seed1 = createMatchSeed('match-123', 1705770000000);
            const seed2 = createMatchSeed('match-123', 1705770001000);

            expect(seed1).not.toEqual(seed2);
        });

        it('should always return a positive integer', () => {
            for (let i = 0; i < 100; i++) {
                const seed = createMatchSeed(`match-${i}`, Date.now() + i);
                expect(seed).toBeGreaterThanOrEqual(0);
                expect(Number.isInteger(seed)).toBe(true);
            }
        });
    });
});
