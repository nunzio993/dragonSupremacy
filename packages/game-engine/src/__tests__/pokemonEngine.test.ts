/**
 * Unit tests for the Pokémon-style simulateTurn function
 */
import {
    simulateTurn,
    createInitialBattleState,
    createCreatureInstance,
    getTypeEffectiveness,
} from '../pokemonEngine.js';
import { BattleState, PlayerAction, CreatureInstance } from '@nft-autobattler/shared-types';

// ============================================
// TEST HELPERS
// ============================================

function createTestCreature(
    id: string,
    stats: Partial<{ hp: number; atk: number; def: number; spd: number }> = {},
    moves: string[] = ['tackle']
): CreatureInstance {
    return createCreatureInstance(
        `instance-${id}`,
        id,
        {
            hp: stats.hp ?? 100,
            atk: stats.atk ?? 50,
            def: stats.def ?? 50,
            spd: stats.spd ?? 50,
        },
        moves
    );
}

function createTestBattle(
    p1Creature: CreatureInstance,
    p2Creature: CreatureInstance,
    p1Bench: CreatureInstance[] = [],
    p2Bench: CreatureInstance[] = []
): BattleState {
    return createInitialBattleState(
        'test-battle',
        12345,
        'player1',
        'player2',
        [p1Creature, ...p1Bench],
        [p2Creature, ...p2Bench]
    );
}

// ============================================
// TYPE EFFECTIVENESS TESTS
// ============================================

describe('Type Effectiveness', () => {
    it('should return 2.0x for super effective (FIRE vs GRASS)', () => {
        const multiplier = getTypeEffectiveness('FIRE', 'GRASS');
        expect(multiplier).toBe(2.0);
    });

    it('should return 0.5x for not very effective (FIRE vs WATER)', () => {
        const multiplier = getTypeEffectiveness('FIRE', 'WATER');
        expect(multiplier).toBe(0.5);
    });

    it('should return 0x for immune (ELECTRIC vs EARTH)', () => {
        const multiplier = getTypeEffectiveness('ELECTRIC', 'EARTH');
        expect(multiplier).toBe(0);
    });

    it('should return 1.0x for neutral matchup (NEUTRAL vs FIRE)', () => {
        const multiplier = getTypeEffectiveness('NEUTRAL', 'FIRE');
        expect(multiplier).toBe(1.0);
    });

    it('should return 2.0x for DARK vs LIGHT', () => {
        const multiplier = getTypeEffectiveness('DARK', 'LIGHT');
        expect(multiplier).toBe(2.0);
    });
});

// ============================================
// DETERMINISM TESTS
// ============================================

describe('Determinism', () => {
    it('should produce identical results with same seed', () => {
        const state = createTestBattle(
            createTestCreature('c1', { spd: 50 }),
            createTestCreature('c2', { spd: 50 })
        );

        const action1: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' };
        const action2: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result1 = simulateTurn(state, action1, action2, 99999);
        const result2 = simulateTurn(state, action1, action2, 99999);

        expect(result1.player1.active?.currentHp).toBe(result2.player1.active?.currentHp);
        expect(result1.player2.active?.currentHp).toBe(result2.player2.active?.currentHp);
        expect(result1.lastTurnEvents.length).toBe(result2.lastTurnEvents.length);
    });

    it('should produce different results with different seeds for speed ties', () => {
        const state = createTestBattle(
            createTestCreature('c1', { spd: 50 }),
            createTestCreature('c2', { spd: 50 })
        );

        const action1: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' };
        const action2: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        // With speed ties, different seeds should give different action orders
        const results = new Set<string>();
        for (let seed = 1; seed <= 20; seed++) {
            const result = simulateTurn(state, action1, action2, seed);
            // Check which creature took damage first (indicates who acted second)
            const events = result.lastTurnEvents
                .filter(e => e.type === 'MOVE_USED')
                .map(e => e.sourcePlayer);
            results.add(JSON.stringify(events));
        }

        // Should have different orderings
        expect(results.size).toBeGreaterThan(1);
    });
});

// ============================================
// SPEED PRIORITY TESTS
// ============================================

describe('Speed Priority', () => {
    it('should let faster creature act first', () => {
        const fastCreature = createTestCreature('fast', { spd: 100 });
        const slowCreature = createTestCreature('slow', { spd: 50 });

        const state = createTestBattle(fastCreature, slowCreature);

        const p1Action: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // First MOVE_USED should be from player 1 (faster)
        const moveEvents = result.lastTurnEvents.filter(e => e.type === 'MOVE_USED');
        expect(moveEvents[0].sourcePlayer).toBe(1);
    });

    it('should prioritize higher priority moves over speed', () => {
        // Slower creature uses quick_strike (priority 1)
        const slowCreature = createTestCreature('slow', { spd: 50 }, ['quick_strike']);
        const fastCreature = createTestCreature('fast', { spd: 100 }, ['tackle']);

        const state = createTestBattle(slowCreature, fastCreature);

        const p1Action: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'quick_strike' };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // First MOVE_USED should be from player 1 (priority move)
        const moveEvents = result.lastTurnEvents.filter(e => e.type === 'MOVE_USED');
        expect(moveEvents[0].sourcePlayer).toBe(1);
    });

    it('should process switches before moves', () => {
        const creature1 = createTestCreature('c1', { spd: 50 });
        const creature2 = createTestCreature('c2', { spd: 100 });
        const benchCreature = createTestCreature('bench', { spd: 30 });

        const state = createTestBattle(creature1, creature2, [benchCreature]);

        const p1Action: PlayerAction = {
            playerId: 'player1',
            type: 'SWITCH',
            switchToInstanceId: 'instance-bench',
        };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // First event after TURN_START should be SWITCH from player 1
        const nonTurnEvents = result.lastTurnEvents.filter(
            e => e.type !== 'TURN_START' && e.type !== 'TURN_END'
        );
        expect(nonTurnEvents[0].type).toBe('SWITCH');
        expect(nonTurnEvents[0].sourcePlayer).toBe(1);
    });
});

// ============================================
// DAMAGE FORMULA TESTS
// ============================================

describe('Damage Formula', () => {
    it('should deal damage based on atk/def ratio', () => {
        const attacker = createTestCreature('attacker', { atk: 100, spd: 100 });
        const defender = createTestCreature('defender', { def: 50, hp: 200, spd: 50 });

        const state = createTestBattle(attacker, defender);

        const p1Action: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // Defender should have taken damage
        expect(result.player2.active?.currentHp).toBeLessThan(200);

        // Should have DAMAGE event
        const damageEvent = result.lastTurnEvents.find(
            e => e.type === 'DAMAGE' && e.sourcePlayer === 1
        );
        expect(damageEvent).toBeDefined();
    });

    it('should deal minimum 1 damage on hit', () => {
        const weakAttacker = createTestCreature('weak', { atk: 1, spd: 100 });
        const toughDefender = createTestCreature('tough', { def: 1000, hp: 100, spd: 50 });

        const state = createTestBattle(weakAttacker, toughDefender);

        const p1Action: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // Defender should have taken at least 1 damage
        expect(result.player2.active?.currentHp).toBeLessThan(100);
    });
});

// ============================================
// STATUS EFFECT TESTS
// ============================================

describe('Status Effects', () => {
    it('should apply burn damage at end of turn', () => {
        const state = createTestBattle(
            createTestCreature('c1', { spd: 100 }),
            createTestCreature('c2', { hp: 160, spd: 50 })
        );

        // Manually set burn status
        state.player2.active!.status = 'BURN';

        const p1Action: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // Should have STATUS_DAMAGE event
        const statusDamage = result.lastTurnEvents.find(e => e.type === 'STATUS_DAMAGE');
        expect(statusDamage).toBeDefined();
        expect(statusDamage?.payload?.status).toBe('BURN');
    });

    it('should apply poison damage at end of turn', () => {
        const state = createTestBattle(
            createTestCreature('c1', { spd: 100 }),
            createTestCreature('c2', { hp: 160, spd: 50 })
        );

        state.player2.active!.status = 'POISON';

        const p1Action: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        const statusDamage = result.lastTurnEvents.find(e => e.type === 'STATUS_DAMAGE');
        expect(statusDamage).toBeDefined();
        expect(statusDamage?.payload?.status).toBe('POISON');
    });

    it('should prevent frozen creature from acting sometimes', () => {
        const state = createTestBattle(
            createTestCreature('c1', { spd: 50 }),
            createTestCreature('c2', { spd: 100 })
        );

        state.player2.active!.status = 'FREEZE';

        // Run multiple seeds to find one where freeze prevents action
        let frozeOnce = false;
        for (let seed = 1; seed <= 50; seed++) {
            const result = simulateTurn(
                state,
                { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' },
                { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' },
                seed
            );

            // Check if player 2 didn't get a MOVE_USED event (was frozen)
            const p2MoveUsed = result.lastTurnEvents.find(
                e => e.type === 'MOVE_USED' && e.sourcePlayer === 2
            );
            if (!p2MoveUsed) {
                frozeOnce = true;
                break;
            }
        }

        expect(frozeOnce).toBe(true);
    });
});

// ============================================
// SWITCHING TESTS
// ============================================

describe('Switching', () => {
    it('should switch to bench creature', () => {
        const active = createTestCreature('active');
        const bench = createTestCreature('bench_creature');

        const state = createTestBattle(active, createTestCreature('enemy'), [bench]);

        const p1Action: PlayerAction = {
            playerId: 'player1',
            type: 'SWITCH',
            switchToInstanceId: 'instance-bench_creature',
        };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // Active should now be bench creature
        expect(result.player1.active?.creatureDefinitionId).toBe('bench_creature');
        expect(result.player1.bench[0].creatureDefinitionId).toBe('active');

        // Should have SWITCH event
        const switchEvent = result.lastTurnEvents.find(e => e.type === 'SWITCH');
        expect(switchEvent).toBeDefined();
    });
});

// ============================================
// FAINT AND WIN CONDITION TESTS
// ============================================

describe('Faint and Win Conditions', () => {
    it('should handle faint and forced switch', () => {
        const state = createTestBattle(
            createTestCreature('attacker', { atk: 1000, spd: 100 }),
            createTestCreature('defender', { hp: 10, spd: 50 }),
            [],
            [createTestCreature('backup', { hp: 100 })]
        );

        const p1Action: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // Should have FAINT event
        const faintEvent = result.lastTurnEvents.find(e => e.type === 'FAINT');
        expect(faintEvent).toBeDefined();

        // Should have auto-switched
        expect(result.player2.active?.creatureDefinitionId).toBe('backup');
        expect(result.player2.fallen.length).toBe(1);

        // Battle should still be ongoing
        expect(result.result).toBe('ONGOING');
    });

    it('should end battle when no bench available after faint', () => {
        const state = createTestBattle(
            createTestCreature('attacker', { atk: 1000, spd: 100 }),
            createTestCreature('defender', { hp: 10, spd: 50 })
        );

        const p1Action: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // Battle should end with PLAYER1_WIN
        expect(result.result).toBe('PLAYER1_WIN');
        expect(result.phase).toBe('FINISHED');
    });

    it('should not change state if battle already finished', () => {
        const state = createTestBattle(
            createTestCreature('c1'),
            createTestCreature('c2')
        );

        // Manually set to finished
        state.result = 'PLAYER1_WIN';
        state.phase = 'FINISHED';

        const result = simulateTurn(
            state,
            { playerId: 'player1', type: 'USE_MOVE', moveId: 'tackle' },
            { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' },
            12345
        );

        // Should return same state unchanged
        expect(result).toBe(state);
    });
});

// ============================================
// COOLDOWN TESTS
// ============================================

describe('Cooldowns', () => {
    it('should set cooldown after using move with cooldown', () => {
        const state = createTestBattle(
            createTestCreature('fire', { spd: 100 }, ['flamethrower']),
            createTestCreature('defender', { hp: 200, spd: 50 })
        );

        const p1Action: PlayerAction = {
            playerId: 'player1',
            type: 'USE_MOVE',
            moveId: 'flamethrower',
        };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // Flamethrower has cooldown of 1, should be 0 after tick
        // (cooldown is set then immediately ticked at end of turn)
        expect(result.player1.active?.moveCooldowns['flamethrower']).toBeDefined();
    });

    it('should tick cooldowns at end of turn', () => {
        const state = createTestBattle(
            createTestCreature('fire', { spd: 100 }, ['ember', 'flamethrower']),
            createTestCreature('defender', { hp: 400, spd: 50 })
        );

        // Set initial cooldown
        state.player1.active!.moveCooldowns['flamethrower'] = 2;

        const p1Action: PlayerAction = { playerId: 'player1', type: 'USE_MOVE', moveId: 'ember' };
        const p2Action: PlayerAction = { playerId: 'player2', type: 'USE_MOVE', moveId: 'tackle' };

        const result = simulateTurn(state, p1Action, p2Action, 12345);

        // Cooldown should have ticked down
        expect(result.player1.active?.moveCooldowns['flamethrower']).toBe(1);
    });
});
