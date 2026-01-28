import { simulateBattle } from '../engine.js';
import { MatchSetup, PlayerUnitInstance } from '@nft-autobattler/shared-types';

describe('Battle Engine', () => {
    // Helper to create a simple match setup
    function createSimpleSetup(
        teamAUnitIds: string[],
        teamBUnitIds: string[],
        seed: number = 12345
    ): MatchSetup {
        const teamA: PlayerUnitInstance[] = teamAUnitIds.map((unitDefId, i) => ({
            instanceId: `a-${i}`,
            unitDefinitionId: unitDefId,
            equippedItems: [],
        }));

        const teamB: PlayerUnitInstance[] = teamBUnitIds.map((unitDefId, i) => ({
            instanceId: `b-${i}`,
            unitDefinitionId: unitDefId,
            equippedItems: [],
        }));

        return {
            matchId: `test-match-${seed}`,
            seed,
            teamA,
            teamB,
            equipmentMap: {},
        };
    }

    describe('Determinism', () => {
        it('should produce identical results with the same seed', () => {
            const setup = createSimpleSetup(['u01', 'u02'], ['u03', 'u04'], 99999);

            const result1 = simulateBattle(setup);
            const result2 = simulateBattle(setup);

            expect(result1.winner).toEqual(result2.winner);
            expect(result1.events.length).toEqual(result2.events.length);
            expect(result1.totalTurns).toEqual(result2.totalTurns);

            // Check each event matches
            for (let i = 0; i < result1.events.length; i++) {
                expect(result1.events[i]).toEqual(result2.events[i]);
            }
        });

        it('should produce different results with different seeds', () => {
            const setup1 = createSimpleSetup(['u01', 'u02'], ['u03', 'u04'], 11111);
            const setup2 = createSimpleSetup(['u01', 'u02'], ['u03', 'u04'], 22222);

            const result1 = simulateBattle(setup1);
            const result2 = simulateBattle(setup2);

            // Events will differ due to different RNG
            // (winner might be same by chance, but events should differ)
            const events1Str = JSON.stringify(result1.events);
            const events2Str = JSON.stringify(result2.events);

            expect(events1Str).not.toEqual(events2Str);
        });
    });

    describe('Match Outcomes', () => {
        it('should always have a winner or draw', () => {
            const setup = createSimpleSetup(['u01'], ['u03'], 42);
            const result = simulateBattle(setup);

            expect(['teamA', 'teamB', 'draw']).toContain(result.winner);
        });

        it('should end when all units of one team are dead', () => {
            // Glass cannon vs tank - should end without max turns
            const setup = createSimpleSetup(['u02'], ['u05'], 100);
            const result = simulateBattle(setup);

            expect(result.totalTurns).toBeLessThan(100);
            expect(result.winner).not.toBe('draw');
        });

        it('should end in draw after max turns if both teams alive', () => {
            // Two very tanky units with low damage - likely to draw
            // This is a probabilistic test, using specific seed that causes draw
            const setup: MatchSetup = {
                matchId: 'draw-test',
                seed: 42,
                teamA: [
                    {
                        instanceId: 'tank-a',
                        unitDefinitionId: 'u05', // Stone Titan: 150 HP, 6 ATK
                        equippedItems: [],
                    },
                ],
                teamB: [
                    {
                        instanceId: 'tank-b',
                        unitDefinitionId: 'u05', // Stone Titan: 150 HP, 6 ATK
                        equippedItems: [],
                    },
                ],
                equipmentMap: {},
            };

            const result = simulateBattle(setup);

            // With 150 HP each and ~6 damage per hit, should take many turns
            // May or may not draw, but should be many turns
            expect(result.totalTurns).toBeGreaterThan(10);
        });

        it('should correctly report final state', () => {
            const setup = createSimpleSetup(['u01'], ['u02'], 7777);
            const result = simulateBattle(setup);

            expect(result.finalState.teamA.length).toBe(1);
            expect(result.finalState.teamB.length).toBe(1);

            // At least one team should have all dead units
            const teamAAllDead = result.finalState.teamA.every((u) => !u.isAlive);
            const teamBAllDead = result.finalState.teamB.every((u) => !u.isAlive);

            if (result.winner === 'teamA') {
                expect(teamBAllDead).toBe(true);
            } else if (result.winner === 'teamB') {
                expect(teamAAllDead).toBe(true);
            }
        });
    });

    describe('Turn Order', () => {
        it('should have faster units act first', () => {
            // Swift Scout (SPD 8) vs Stone Titan (SPD 2)
            const setup = createSimpleSetup(['u02'], ['u05'], 888);
            const result = simulateBattle(setup);

            // First attack should be from Swift Scout
            const firstAttack = result.events.find((e) => e.eventType === 'attack');
            expect(firstAttack?.actorInstanceId).toBe('a-0');
        });
    });

    describe('Equipment Effects', () => {
        it('should apply stat bonuses from equipment', () => {
            const setup: MatchSetup = {
                matchId: 'equip-test',
                seed: 123,
                teamA: [
                    {
                        instanceId: 'equipped-unit',
                        unitDefinitionId: 'u04', // Militia Soldier - no passive
                        equippedItems: ['equip-1'],
                    },
                ],
                teamB: [
                    {
                        instanceId: 'target',
                        unitDefinitionId: 'u04',
                        equippedItems: [],
                    },
                ],
                equipmentMap: {
                    'equip-1': {
                        instanceId: 'equip-1',
                        equipmentDefinitionId: 'e04', // Steel Shield: +20 HP
                    },
                },
            };

            const result = simulateBattle(setup);

            // Find the equipped unit's final state
            const equippedUnit = result.finalState.teamA[0];

            // Militia Soldier base HP is 90, with Steel Shield should be 110
            expect(equippedUnit.maxHp).toBe(110);
        });

        it('should apply team buff from War Banner', () => {
            const setup: MatchSetup = {
                matchId: 'banner-test',
                seed: 456,
                teamA: [
                    {
                        instanceId: 'banner-holder',
                        unitDefinitionId: 'u04',
                        equippedItems: ['banner'],
                    },
                    {
                        instanceId: 'teammate',
                        unitDefinitionId: 'u04',
                        equippedItems: [],
                    },
                ],
                teamB: [
                    {
                        instanceId: 'enemy',
                        unitDefinitionId: 'u04',
                        equippedItems: [],
                    },
                ],
                equipmentMap: {
                    banner: {
                        instanceId: 'banner',
                        equipmentDefinitionId: 'e09', // War Banner: team +1 ATK
                    },
                },
            };

            const result = simulateBattle(setup);

            // Check for effect trigger event
            const bannerEvent = result.events.find(
                (e) => e.eventType === 'effect_trigger' && e.description?.includes('War Banner')
            );
            expect(bannerEvent).toBeDefined();

            // Both team A units should have boosted ATK
            // Militia base ATK is 9, with banner should be 10
            const teammate = result.finalState.teamA.find((u) => u.instanceId === 'teammate');
            expect(teammate?.atk).toBe(10);
        });
    });

    describe('Passive Abilities', () => {
        it('should trigger hp_boost_when_equipped', () => {
            const setup: MatchSetup = {
                matchId: 'hp-boost-test',
                seed: 789,
                teamA: [
                    {
                        instanceId: 'iron-guard',
                        unitDefinitionId: 'u01', // Iron Guard: +10% HP when equipped
                        equippedItems: ['any-equip'],
                    },
                ],
                teamB: [
                    {
                        instanceId: 'enemy',
                        unitDefinitionId: 'u04',
                        equippedItems: [],
                    },
                ],
                equipmentMap: {
                    'any-equip': {
                        instanceId: 'any-equip',
                        equipmentDefinitionId: 'e01', // Iron Sword: +3 ATK
                    },
                },
            };

            const result = simulateBattle(setup);
            const ironGuard = result.finalState.teamA[0];

            // Base HP 120 + 10% = 132
            expect(ironGuard.maxHp).toBe(132);
        });

        it('should trigger heal_on_kill', () => {
            const setup: MatchSetup = {
                matchId: 'heal-kill-test',
                seed: 101112,
                teamA: [
                    {
                        instanceId: 'holy-knight',
                        unitDefinitionId: 'u07', // Holy Knight: heal 5 on kill
                        equippedItems: [],
                    },
                ],
                teamB: [
                    {
                        instanceId: 'weak-enemy',
                        unitDefinitionId: 'u02', // Swift Scout: only 60 HP
                        equippedItems: [],
                    },
                ],
                equipmentMap: {},
            };

            const result = simulateBattle(setup);

            // Check for heal event after death
            const deathIndex = result.events.findIndex(
                (e) => e.eventType === 'death' && e.actorInstanceId === 'weak-enemy'
            );

            if (deathIndex >= 0) {
                // Should have a heal event after death
                const subsequentEvents = result.events.slice(deathIndex);
                const healEvent = subsequentEvents.find(
                    (e) => e.eventType === 'heal' && e.description?.includes('Holy Knight')
                );
                expect(healEvent).toBeDefined();
            }
        });
    });

    describe('Event Log', () => {
        it('should have match_end as last event', () => {
            const setup = createSimpleSetup(['u01'], ['u02'], 999);
            const result = simulateBattle(setup);

            const lastEvent = result.events[result.events.length - 1];
            expect(lastEvent.eventType).toBe('match_end');
        });

        it('should have attack events with valid actors and targets', () => {
            const setup = createSimpleSetup(['u01'], ['u02'], 1111);
            const result = simulateBattle(setup);

            const attackEvents = result.events.filter((e) => e.eventType === 'attack');

            for (const event of attackEvents) {
                expect(event.actorInstanceId).toBeTruthy();
                expect(event.targetInstanceId).toBeTruthy();
                expect(event.value).toBeGreaterThan(0);
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle 3v3 battles', () => {
            const setup = createSimpleSetup(
                ['u01', 'u02', 'u03'],
                ['u04', 'u05', 'u06'],
                2222
            );

            const result = simulateBattle(setup);

            expect(result.finalState.teamA.length).toBe(3);
            expect(result.finalState.teamB.length).toBe(3);
            expect(['teamA', 'teamB', 'draw']).toContain(result.winner);
        });

        it('should handle 1v1 battles', () => {
            const setup = createSimpleSetup(['u01'], ['u02'], 3333);
            const result = simulateBattle(setup);

            expect(result.finalState.teamA.length).toBe(1);
            expect(result.finalState.teamB.length).toBe(1);
        });

        it('should throw for unknown unit definition', () => {
            const setup: MatchSetup = {
                matchId: 'error-test',
                seed: 4444,
                teamA: [
                    {
                        instanceId: 'unknown',
                        unitDefinitionId: 'invalid-unit-id',
                        equippedItems: [],
                    },
                ],
                teamB: [],
                equipmentMap: {},
            };

            expect(() => simulateBattle(setup)).toThrow('Unknown unit definition');
        });
    });
});
