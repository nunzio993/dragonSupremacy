/**
 * Quick verification script for turn-engine
 * Run with: node --experimental-vm-modules test-turn-engine.mjs
 */
import {
    simulateTurn,
    createBattleState,
    createCreatureState,
    getTypeEffectiveness
} from './dist/turn-engine.js';

console.log('=== Turn Engine Verification ===\n');

// Test 1: Type effectiveness
console.log('1. Type Effectiveness Tests:');
const fireVsGrass = getTypeEffectiveness('fire', ['grass']);
console.log(`   Fire vs Grass: ${fireVsGrass}x (expected 1.5) ${fireVsGrass === 1.5 ? '✓' : '✗'}`);

const waterVsFire = getTypeEffectiveness('water', ['fire']);
console.log(`   Water vs Fire: ${waterVsFire}x (expected 1.5) ${waterVsFire === 1.5 ? '✓' : '✗'}`);

const electricVsGround = getTypeEffectiveness('electric', ['ground']);
console.log(`   Electric vs Ground: ${electricVsGround}x (expected 0) ${electricVsGround === 0 ? '✓' : '✗'}`);

const iceVsDragonFlying = getTypeEffectiveness('ice', ['dragon', 'flying']);
console.log(`   Ice vs Dragon/Flying: ${iceVsDragonFlying}x (expected 2.25) ${iceVsDragonFlying === 2.25 ? '✓' : '✗'}`);

// Test 2: Create creatures
console.log('\n2. Creature Creation:');
const creature1 = createCreatureState('fire_lizard', 'inst-1', ['fire'], {
    hp: 100, atk: 80, def: 60, spAtk: 100, spDef: 70, spd: 90
}, ['ember', 'flamethrower']);
console.log(`   Created ${creature1.definitionId}: HP ${creature1.currentHp}/${creature1.maxHp} ✓`);

const creature2 = createCreatureState('water_turtle', 'inst-2', ['water'], {
    hp: 120, atk: 70, def: 100, spAtk: 80, spDef: 90, spd: 60
}, ['water_gun', 'surf']);
console.log(`   Created ${creature2.definitionId}: HP ${creature2.currentHp}/${creature2.maxHp} ✓`);

// Test 3: Battle state creation
console.log('\n3. Battle State Creation:');
const battleState = createBattleState([creature1], [creature2]);
console.log(`   Turn number: ${battleState.turnNumber}`);
console.log(`   P1 active: ${battleState.p1.activeCreature.definitionId}`);
console.log(`   P2 active: ${battleState.p2.activeCreature.definitionId}`);
console.log(`   State created successfully ✓`);

// Test 4: Simulate a turn
console.log('\n4. Turn Simulation:');
const p1Action = { type: 'USE_MOVE', moveId: 'ember' };
const p2Action = { type: 'USE_MOVE', moveId: 'water_gun' };
const seed = 12345;

const result = simulateTurn(battleState, p1Action, p2Action, seed);
console.log(`   Turn ${result.newState.turnNumber} completed`);
console.log(`   Events generated: ${result.events.length}`);
console.log(`   P2 HP after: ${result.newState.p2.activeCreature.currentHp}/${result.newState.p2.activeCreature.maxHp}`);
console.log(`   P1 HP after: ${result.newState.p1.activeCreature.currentHp}/${result.newState.p1.activeCreature.maxHp}`);
console.log(`   Battle ended: ${result.battleEnded}`);

// Print events
console.log('\n   Events:');
for (const event of result.events) {
    console.log(`   - [${event.type}] ${event.description}`);
}

// Test 5: Determinism
console.log('\n5. Determinism Test:');
const result2 = simulateTurn(battleState, p1Action, p2Action, seed);
const identical =
    result.newState.p1.activeCreature.currentHp === result2.newState.p1.activeCreature.currentHp &&
    result.newState.p2.activeCreature.currentHp === result2.newState.p2.activeCreature.currentHp &&
    result.events.length === result2.events.length;
console.log(`   Same seed produces same result: ${identical ? '✓' : '✗'}`);

// Test 6: Speed priority
console.log('\n6. Speed Priority Test:');
const fastCreature = createCreatureState('fast', 'fast-1', ['normal'], {
    hp: 100, atk: 50, def: 50, spAtk: 50, spDef: 50, spd: 150
}, ['tackle']);
const slowCreature = createCreatureState('slow', 'slow-1', ['normal'], {
    hp: 100, atk: 50, def: 50, spAtk: 50, spDef: 50, spd: 30
}, ['tackle']);
const speedState = createBattleState([fastCreature], [slowCreature]);
const speedResult = simulateTurn(speedState,
    { type: 'USE_MOVE', moveId: 'tackle' },
    { type: 'USE_MOVE', moveId: 'tackle' },
    99999
);
const orderEvent = speedResult.events.find(e => e.type === 'action_order');
console.log(`   Faster creature (SPD 150) acts first: ${orderEvent?.details?.order?.[0] === 'p1' ? '✓' : '✗'}`);

console.log('\n=== All Verification Complete ===');
