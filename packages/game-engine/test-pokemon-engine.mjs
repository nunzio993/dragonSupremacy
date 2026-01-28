/**
 * Quick verification script for pokemonEngine
 * Run with: node test-pokemon-engine.mjs
 */
import {
    simulateTurn,
    createInitialBattleState,
    createCreatureInstance,
    getTypeEffectiveness
} from './dist/pokemonEngine.js';

console.log('=== Pokémon Engine Verification ===\n');

// Test 1: Type effectiveness
console.log('1. Type Effectiveness Tests:');
const fireVsGrass = getTypeEffectiveness('FIRE', 'GRASS');
console.log(`   FIRE vs GRASS: ${fireVsGrass}x (expected 2.0) ${fireVsGrass === 2.0 ? '✓' : '✗'}`);

const waterVsFire = getTypeEffectiveness('WATER', 'FIRE');
console.log(`   WATER vs FIRE: ${waterVsFire}x (expected 2.0) ${waterVsFire === 2.0 ? '✓' : '✗'}`);

const electricVsEarth = getTypeEffectiveness('ELECTRIC', 'EARTH');
console.log(`   ELECTRIC vs EARTH: ${electricVsEarth}x (expected 0) ${electricVsEarth === 0 ? '✓' : '✗'}`);

// Test 2: Create creatures
console.log('\n2. Creature Creation:');
const creature1 = createCreatureInstance('fire-1', 'flame_lizard_id', {
    hp: 100, atk: 80, def: 60, spd: 90
}, ['ember', 'flamethrower']);
console.log(`   Created ${creature1.creatureDefinitionId}: HP ${creature1.currentHp}/${creature1.maxHp} ✓`);
console.log(`   Status: ${creature1.status}, isFainted: ${creature1.isFainted} ✓`);

const creature2 = createCreatureInstance('water-1', 'aqua_turtle_id', {
    hp: 120, atk: 70, def: 100, spd: 60
}, ['water_gun', 'hydro_pump']);
console.log(`   Created ${creature2.creatureDefinitionId}: HP ${creature2.currentHp}/${creature2.maxHp} ✓`);

// Test 3: Battle state creation
console.log('\n3. Battle State Creation:');
const battleState = createInitialBattleState(
    'battle-1', 12345, 'player1', 'player2',
    [creature1], [creature2]
);
console.log(`   Battle ID: ${battleState.id}`);
console.log(`   Turn: ${battleState.turnNumber}, Phase: ${battleState.phase}, Result: ${battleState.result}`);
console.log(`   P1 active: ${battleState.player1.active?.creatureDefinitionId}`);
console.log(`   P2 active: ${battleState.player2.active?.creatureDefinitionId}`);
console.log(`   State created successfully ✓`);

// Test 4: Simulate a turn
console.log('\n4. Turn Simulation:');
const p1Action = { playerId: 'player1', type: 'USE_MOVE', moveId: 'ember' };
const p2Action = { playerId: 'player2', type: 'USE_MOVE', moveId: 'water_gun' };
const seed = 12345;

const result = simulateTurn(battleState, p1Action, p2Action, seed);
console.log(`   Turn ${result.turnNumber} completed`);
console.log(`   Events generated: ${result.lastTurnEvents.length}`);
console.log(`   P2 HP after: ${result.player2.active?.currentHp}/${result.player2.active?.maxHp}`);
console.log(`   P1 HP after: ${result.player1.active?.currentHp}/${result.player1.active?.maxHp}`);
console.log(`   Result: ${result.result}`);

// Print events
console.log('\n   Events:');
for (const event of result.lastTurnEvents) {
    console.log(`   - [${event.type}] ${event.description}`);
}

// Test 5: Determinism
console.log('\n5. Determinism Test:');
const result2 = simulateTurn(battleState, p1Action, p2Action, seed);
const identical =
    result.player1.active?.currentHp === result2.player1.active?.currentHp &&
    result.player2.active?.currentHp === result2.player2.active?.currentHp &&
    result.lastTurnEvents.length === result2.lastTurnEvents.length;
console.log(`   Same seed produces same result: ${identical ? '✓' : '✗'}`);

// Test 6: Speed priority
console.log('\n6. Speed Priority Test:');
const fastCreature = createCreatureInstance('fast-1', 'fast_creature', {
    hp: 100, atk: 50, def: 50, spd: 150
}, ['tackle']);
const slowCreature = createCreatureInstance('slow-1', 'slow_creature', {
    hp: 100, atk: 50, def: 50, spd: 30
}, ['tackle']);
const speedState = createInitialBattleState(
    'speed-test', 99999, 'p1', 'p2',
    [fastCreature], [slowCreature]
);
const speedResult = simulateTurn(speedState,
    { playerId: 'p1', type: 'USE_MOVE', moveId: 'tackle' },
    { playerId: 'p2', type: 'USE_MOVE', moveId: 'tackle' },
    99999
);
const moveEvents = speedResult.lastTurnEvents.filter(e => e.type === 'MOVE_USED');
console.log(`   Faster creature (SPD 150) acts first: ${moveEvents[0]?.sourcePlayer === 1 ? '✓' : '✗'}`);

// Test 7: Faint handling
console.log('\n7. Faint Handling Test:');
const strongCreature = createCreatureInstance('strong-1', 'strong', {
    hp: 100, atk: 1000, def: 50, spd: 100
}, ['tackle']);
const weakCreature = createCreatureInstance('weak-1', 'weak', {
    hp: 10, atk: 50, def: 50, spd: 50
}, ['tackle']);
const faintState = createInitialBattleState(
    'faint-test', 11111, 'p1', 'p2',
    [strongCreature], [weakCreature]
);
const faintResult = simulateTurn(faintState,
    { playerId: 'p1', type: 'USE_MOVE', moveId: 'tackle' },
    { playerId: 'p2', type: 'USE_MOVE', moveId: 'tackle' },
    11111
);
const hasFaint = faintResult.lastTurnEvents.some(e => e.type === 'FAINT');
console.log(`   Faint event triggered: ${hasFaint ? '✓' : '✗'}`);
console.log(`   Result: ${faintResult.result} ${faintResult.result === 'PLAYER1_WIN' ? '✓' : '✗'}`);

console.log('\n=== All Verification Complete ===');
