/**
 * Battle Engine Test
 * Verifies determinism: same seed = same result
 */

import {
    DeterministicRNG,
    initializeBattle,
    executeTurn,
    BattleCreature,
    BattleAction,
    Move,
    ElementType
} from './index.js';

// Sample moves for testing
const sampleMoves: Move[] = [
    {
        moveId: 'spark',
        name: 'Spark',
        type: 'ELECTRIC',
        category: 'SPECIAL',
        power: 55,
        accuracy: 100,
        cooldownMax: 0,
        priority: 0,
        statusEffect: 'PARALYZE',
        statusChance: 0.10
    },
    {
        moveId: 'thunderbolt',
        name: 'Thunderbolt',
        type: 'ELECTRIC',
        category: 'SPECIAL',
        power: 95,
        accuracy: 90,
        cooldownMax: 1,
        priority: 0,
        statusEffect: 'PARALYZE',
        statusChance: 0.20
    },
    {
        moveId: 'volt_switch',
        name: 'Volt Switch',
        type: 'ELECTRIC',
        category: 'PHYSICAL',
        power: 70,
        accuracy: 95,
        cooldownMax: 1,
        priority: 2,
        statusChance: 0
    },
    {
        moveId: 'thunder',
        name: 'Thunder',
        type: 'ELECTRIC',
        category: 'SPECIAL',
        power: 130,
        accuracy: 70,
        cooldownMax: 3,
        priority: 0,
        statusEffect: 'PARALYZE',
        statusChance: 0.40
    }
];

const iceMoves: Move[] = [
    {
        moveId: 'ice_shard',
        name: 'Ice Shard',
        type: 'ICE',
        category: 'PHYSICAL',
        power: 50,
        accuracy: 100,
        cooldownMax: 0,
        priority: 1,
        statusChance: 0
    },
    {
        moveId: 'blizzard',
        name: 'Blizzard',
        type: 'ICE',
        category: 'SPECIAL',
        power: 115,
        accuracy: 75,
        cooldownMax: 3,
        priority: 0,
        statusEffect: 'FREEZE',
        statusChance: 0.25
    },
    {
        moveId: 'frost_armor',
        name: 'Frost Armor',
        type: 'ICE',
        category: 'STATUS',
        power: 0,
        accuracy: 100,
        cooldownMax: 2,
        priority: 0,
        statusChance: 0
    },
    {
        moveId: 'absolute_zero',
        name: 'Absolute Zero',
        type: 'ICE',
        category: 'SPECIAL',
        power: 90,
        accuracy: 85,
        cooldownMax: 2,
        priority: 0,
        statusEffect: 'FREEZE',
        statusChance: 0.40
    }
];

function createTestCreature(
    id: string,
    name: string,
    ownerId: string,
    elementType: ElementType,
    moves: Move[]
): BattleCreature {
    return {
        id,
        name,
        ownerId,
        elementType,
        talent: 70,
        temperament: 'NEUTRAL',
        attributes: {
            STR: 60,
            AGI: 75,
            SPD: 80,
            REF: 55,
            END: 50,
            VIT: 45,
            INT: 50,
            PRC: 55,
            RGN: 40
        },
        moves,
        moveMastery: {
            [moves[0].moveId]: 1.0,
            [moves[1].moveId]: 1.0,
            [moves[2].moveId]: 1.0,
            [moves[3].moveId]: 1.0
        },
        aptitudeVsType: {
            FIRE: 1.0,
            WATER: 1.0,
            GRASS: 1.0,
            ELECTRIC: 1.0,
            ICE: 1.0,
            EARTH: 1.0,
            DARK: 1.0,
            LIGHT: 1.0
        },
        currentHp: 0,
        maxHp: 0,
        cooldowns: {},
        statusEffects: []
    };
}

/**
 * Test RNG determinism
 */
function testRngDeterminism(): boolean {
    console.log('Testing RNG determinism...');

    const seed = 'abc123def456';
    const rng1 = new DeterministicRNG(seed);
    const rng2 = new DeterministicRNG(seed);

    const results1: number[] = [];
    const results2: number[] = [];

    for (let i = 0; i < 100; i++) {
        results1.push(rng1.next());
        results2.push(rng2.next());
    }

    for (let i = 0; i < 100; i++) {
        if (results1[i] !== results2[i]) {
            console.error(`RNG mismatch at index ${i}: ${results1[i]} !== ${results2[i]}`);
            return false;
        }
    }

    console.log('✅ RNG determinism test PASSED');
    return true;
}

/**
 * Test battle determinism
 */
function testBattleDeterminism(): boolean {
    console.log('Testing battle determinism...');

    const seed = 'battle_test_seed_12345';

    // Create creatures
    const thunderSerpent = createTestCreature(
        'creature_a',
        'Thunder Serpent',
        'player_a',
        'ELECTRIC',
        sampleMoves
    );

    const frostWyrm = createTestCreature(
        'creature_b',
        'Frost Wyrm',
        'player_b',
        'ICE',
        iceMoves
    );

    // Run battle twice with same seed
    const results1 = runBattle(seed, thunderSerpent, frostWyrm);
    const results2 = runBattle(seed, thunderSerpent, frostWyrm);

    // Compare results
    if (results1.winner !== results2.winner) {
        console.error(`Winner mismatch: ${results1.winner} !== ${results2.winner}`);
        return false;
    }

    if (results1.turns !== results2.turns) {
        console.error(`Turn count mismatch: ${results1.turns} !== ${results2.turns}`);
        return false;
    }

    if (results1.finalHpA !== results2.finalHpA) {
        console.error(`Final HP A mismatch: ${results1.finalHpA} !== ${results2.finalHpA}`);
        return false;
    }

    if (results1.finalHpB !== results2.finalHpB) {
        console.error(`Final HP B mismatch: ${results1.finalHpB} !== ${results2.finalHpB}`);
        return false;
    }

    console.log('✅ Battle determinism test PASSED');
    console.log(`   Winner: ${results1.winner}`);
    console.log(`   Turns: ${results1.turns}`);
    console.log(`   Final HP: A=${results1.finalHpA}, B=${results1.finalHpB}`);

    return true;
}

/**
 * Run a complete battle with predefined actions
 */
function runBattle(
    seed: string,
    creatureATemplate: BattleCreature,
    creatureBTemplate: BattleCreature
): { winner: string | undefined; turns: number; finalHpA: number; finalHpB: number } {
    // Deep clone creatures
    const creatureA = JSON.parse(JSON.stringify(creatureATemplate));
    const creatureB = JSON.parse(JSON.stringify(creatureBTemplate));

    // Initialize battle
    const state = initializeBattle(
        'test_battle',
        seed,
        'player_a',
        'player_b',
        creatureA,
        creatureB
    );

    // Simulate battle with alternating moves
    let turnCount = 0;
    const maxTurns = 50;

    while (!state.winner && turnCount < maxTurns) {
        // Select moves (predictable pattern for testing)
        const moveIndexA = turnCount % creatureA.moves.length;
        const moveIndexB = turnCount % creatureB.moves.length;

        // Find available moves (not on cooldown)
        let moveA = creatureA.moves[moveIndexA];
        if ((state.creatureA.cooldowns[moveA.moveId] || 0) > 0) {
            moveA = creatureA.moves.find((m: Move) =>
                (state.creatureA.cooldowns[m.moveId] || 0) === 0
            ) || creatureA.moves[0];
        }

        let moveB = creatureB.moves[moveIndexB];
        if ((state.creatureB.cooldowns[moveB.moveId] || 0) > 0) {
            moveB = creatureB.moves.find((m: Move) =>
                (state.creatureB.cooldowns[m.moveId] || 0) === 0
            ) || creatureB.moves[0];
        }

        const actionA: BattleAction = {
            creatureId: state.creatureA.id,
            moveId: moveA.moveId,
            targetId: state.creatureB.id
        };

        const actionB: BattleAction = {
            creatureId: state.creatureB.id,
            moveId: moveB.moveId,
            targetId: state.creatureA.id
        };

        executeTurn(state, actionA, actionB);
        turnCount++;
    }

    return {
        winner: state.winner,
        turns: turnCount,
        finalHpA: state.creatureA.currentHp,
        finalHpB: state.creatureB.currentHp
    };
}

/**
 * Run all tests
 */
export function runAllTests(): boolean {
    console.log('═══════════════════════════════════════════');
    console.log('       BATTLE ENGINE TESTS');
    console.log('═══════════════════════════════════════════\n');

    let allPassed = true;

    if (!testRngDeterminism()) allPassed = false;
    if (!testBattleDeterminism()) allPassed = false;

    console.log('\n═══════════════════════════════════════════');
    if (allPassed) {
        console.log('       ALL TESTS PASSED ✅');
    } else {
        console.log('       SOME TESTS FAILED ❌');
    }
    console.log('═══════════════════════════════════════════');

    return allPassed;
}

// Run tests if this file is executed directly
runAllTests();
