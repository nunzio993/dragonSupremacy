/**
 * Pokémon-Style Turn-Based Battle Engine
 * 
 * Pure function: simulateTurn(previousState, p1Action, p2Action, seed) -> BattleState
 * 
 * Features:
 * - Stateless: returns new state, never mutates input
 * - Deterministic: same inputs + seed = same output
 * - Type effectiveness
 * - Status effects
 * - Move cooldowns
 * - Speed/priority resolution
 */

import {
    BattleState,
    BattleEvent,
    BattleEventType,
    BattleResult,
    PlayerAction,
    PlayerSide,
    CreatureInstance,
    MoveDefinition,
    ElementType,
    StatusEffectType,
    MOVE_BY_ID,
} from '@nft-autobattler/shared-types';
import { createRng, Rng } from './rng.js';

// ============================================
// TYPE EFFECTIVENESS CHART
// ============================================

type EffectivenessChart = Partial<Record<ElementType, Partial<Record<ElementType, number>>>>;

/**
 * Type effectiveness multipliers (attacking -> defending -> multiplier)
 * Missing entries default to 1.0
 */
const TYPE_CHART: EffectivenessChart = {
    FIRE: {
        FIRE: 0.5,
        WATER: 0.5,
        GRASS: 2.0,
        ICE: 2.0,
        EARTH: 0.5,
    },
    WATER: {
        FIRE: 2.0,
        WATER: 0.5,
        GRASS: 0.5,
        EARTH: 2.0,
    },
    GRASS: {
        FIRE: 0.5,
        WATER: 2.0,
        GRASS: 0.5,
        EARTH: 2.0,
    },
    ELECTRIC: {
        WATER: 2.0,
        ELECTRIC: 0.5,
        GRASS: 0.5,
        EARTH: 0, // Immune
    },
    ICE: {
        FIRE: 0.5,
        WATER: 0.5,
        GRASS: 2.0,
        ICE: 0.5,
        EARTH: 2.0,
    },
    EARTH: {
        FIRE: 2.0,
        ELECTRIC: 2.0,
        GRASS: 0.5,
    },
    DARK: {
        DARK: 0.5,
        LIGHT: 2.0,
    },
    LIGHT: {
        DARK: 2.0,
        LIGHT: 0.5,
    },
    NEUTRAL: {
        // Neutral is neutral to everything
    },
};

/**
 * Get type effectiveness multiplier
 */
export function getTypeEffectiveness(attackType: ElementType, defenderType: ElementType): number {
    const chart = TYPE_CHART[attackType];
    if (chart && chart[defenderType] !== undefined) {
        return chart[defenderType]!;
    }
    return 1.0; // Default neutral
}

// ============================================
// DEEP CLONE UTILITIES
// ============================================

function cloneCreature(c: CreatureInstance): CreatureInstance {
    return {
        ...c,
        moveCooldowns: { ...c.moveCooldowns },
        knownMoveIds: [...c.knownMoveIds],
    };
}

function clonePlayerSide(p: PlayerSide): PlayerSide {
    return {
        playerId: p.playerId,
        active: p.active ? cloneCreature(p.active) : null,
        bench: p.bench.map(cloneCreature),
        fallen: p.fallen.map(cloneCreature),
        lineupDefinitionIds: [...p.lineupDefinitionIds],
    };
}

function cloneBattleState(state: BattleState): BattleState {
    return {
        id: state.id,
        seed: state.seed,
        turnNumber: state.turnNumber,
        phase: state.phase,
        result: state.result,
        player1: clonePlayerSide(state.player1),
        player2: clonePlayerSide(state.player2),
        lastTurnEvents: [],
    };
}

// ============================================
// INTERNAL ACTION REPRESENTATION
// ============================================

interface ResolvedAction {
    player: 1 | 2;
    type: 'USE_MOVE' | 'SWITCH';
    moveId?: string;
    move?: MoveDefinition;
    switchToInstanceId?: string;
    creature: CreatureInstance;
    priority: number;
    speed: number;
}

// ============================================
// FALLBACK MOVE (struggle)
// ============================================

const STRUGGLE_MOVE: MoveDefinition = {
    id: 'struggle',
    name: 'Struggle',
    elementType: 'NEUTRAL',
    category: 'PHYSICAL',
    basePower: 30,
    accuracy: 100,
    cooldown: 0,
    priority: 0,
    description: 'A desperate attack used when no moves are available.',
};

// ============================================
// MAIN SIMULATION FUNCTION
// ============================================

/**
 * Simulates a single turn of combat.
 * 
 * @param previousState - The state before this turn
 * @param p1Action - Player 1's action (null = use first available move)
 * @param p2Action - Player 2's action (null = use first available move)
 * @param seed - RNG seed for this turn
 * @returns New battle state after the turn
 */
export function simulateTurn(
    previousState: BattleState,
    p1Action: PlayerAction | null,
    p2Action: PlayerAction | null,
    seed: number
): BattleState {
    // If battle is over, return unchanged
    if (previousState.result !== 'ONGOING') {
        return previousState;
    }

    // Clone state to avoid mutation
    const state = cloneBattleState(previousState);
    state.lastTurnEvents = [];
    state.turnNumber++;
    state.phase = 'RESOLVING_TURN';

    // Create RNG combining seed and turn number for determinism
    const rng = createRng(seed + state.turnNumber);

    // Add turn start event
    addEvent(state, 1, 'TURN_START', { turn: state.turnNumber }, `Turn ${state.turnNumber} begins`);

    // Build resolved actions
    const action1 = resolveAction(state.player1, p1Action, 1, rng);
    const action2 = resolveAction(state.player2, p2Action, 2, rng);

    if (!action1 || !action2) {
        // One side has no active creature - check win condition
        checkWinCondition(state);
        return state;
    }

    // Determine execution order
    const [first, second] = determineOrder(action1, action2, rng);

    // Execute first action
    executeAction(state, first, first.player === 1 ? state.player2 : state.player1, rng);

    // Execute second action (if caster not fainted)
    const secondCreature = second.player === 1
        ? state.player1.active
        : state.player2.active;

    if (secondCreature && !secondCreature.isFainted) {
        executeAction(state, second, second.player === 1 ? state.player2 : state.player1, rng);
    }

    // End-of-turn effects
    applyEndOfTurnEffects(state, rng);

    // Tick cooldowns
    tickAllCooldowns(state);

    // Check win condition
    checkWinCondition(state);

    // Add turn end event
    addEvent(state, 1, 'TURN_END', { turn: state.turnNumber }, `Turn ${state.turnNumber} ends`);

    // Set phase based on result
    state.phase = state.result === 'ONGOING' ? 'WAITING_FOR_ACTIONS' : 'FINISHED';

    return state;
}

// ============================================
// ACTION RESOLUTION
// ============================================

function resolveAction(
    side: PlayerSide,
    action: PlayerAction | null,
    player: 1 | 2,
    rng: Rng
): ResolvedAction | null {
    if (!side.active || side.active.isFainted) {
        return null;
    }

    const creature = side.active;

    // If no action provided, default to first available move
    if (!action) {
        action = {
            playerId: side.playerId,
            type: 'USE_MOVE',
            moveId: getFirstAvailableMove(creature),
        };
    }

    if (action.type === 'SWITCH') {
        return {
            player,
            type: 'SWITCH',
            switchToInstanceId: action.switchToInstanceId,
            creature,
            priority: 6, // Switches always go first (high priority)
            speed: creature.spd,
        };
    }

    // USE_MOVE
    let moveId = action.moveId || getFirstAvailableMove(creature);
    let move = MOVE_BY_ID[moveId];

    // Check cooldown - if on cooldown, use fallback
    if (!move || (creature.moveCooldowns[moveId] && creature.moveCooldowns[moveId] > 0)) {
        moveId = getFirstAvailableMove(creature);
        move = MOVE_BY_ID[moveId] || STRUGGLE_MOVE;
    }

    const priority = move.priority ?? 0;
    let speed = creature.spd;

    // Paralysis halves speed
    if (creature.status === 'PARALYSIS') {
        speed = Math.floor(speed / 2);
    }

    return {
        player,
        type: 'USE_MOVE',
        moveId,
        move,
        creature,
        priority,
        speed,
    };
}

function getFirstAvailableMove(creature: CreatureInstance): string {
    for (const moveId of creature.knownMoveIds) {
        const cooldown = creature.moveCooldowns[moveId] || 0;
        if (cooldown <= 0) {
            return moveId;
        }
    }
    // All moves on cooldown - return first move anyway (will use struggle)
    return creature.knownMoveIds[0] || 'tackle';
}

// ============================================
// ORDER DETERMINATION
// ============================================

function determineOrder(
    action1: ResolvedAction,
    action2: ResolvedAction,
    rng: Rng
): [ResolvedAction, ResolvedAction] {
    // Compare priority first
    if (action1.priority > action2.priority) return [action1, action2];
    if (action2.priority > action1.priority) return [action2, action1];

    // Same priority - compare speed
    if (action1.speed > action2.speed) return [action1, action2];
    if (action2.speed > action1.speed) return [action2, action1];

    // Speed tie - random
    return rng.chance(50) ? [action1, action2] : [action2, action1];
}

// ============================================
// ACTION EXECUTION
// ============================================

function executeAction(
    state: BattleState,
    action: ResolvedAction,
    targetSide: PlayerSide,
    rng: Rng
): void {
    const playerSide = action.player === 1 ? state.player1 : state.player2;
    const creature = playerSide.active;

    if (!creature || creature.isFainted) return;

    // Check if creature can act (status effects)
    if (!canAct(state, creature, action.player, rng)) {
        return;
    }

    if (action.type === 'SWITCH') {
        executeSwitch(state, playerSide, action);
    } else {
        executeMove(state, playerSide, targetSide, action, rng);
    }
}

function canAct(state: BattleState, creature: CreatureInstance, player: 1 | 2, rng: Rng): boolean {
    if (creature.status === 'SLEEP') {
        if (creature.statusTurnsRemaining && creature.statusTurnsRemaining > 0) {
            creature.statusTurnsRemaining--;
            addEvent(state, player, 'STATUS_APPLIED',
                { status: 'SLEEP' },
                `${creature.creatureDefinitionId} is fast asleep!`);

            if (creature.statusTurnsRemaining <= 0) {
                creature.status = 'NONE';
                addEvent(state, player, 'STATUS_EXPIRED',
                    { status: 'SLEEP' },
                    `${creature.creatureDefinitionId} woke up!`);
            }
            return creature.statusTurnsRemaining !== undefined && creature.statusTurnsRemaining <= 0;
        }
    }

    if (creature.status === 'FREEZE') {
        // 20% chance to thaw
        if (rng.chance(20)) {
            creature.status = 'NONE';
            addEvent(state, player, 'STATUS_EXPIRED',
                { status: 'FREEZE' },
                `${creature.creatureDefinitionId} thawed out!`);
            return true;
        }
        addEvent(state, player, 'STATUS_APPLIED',
            { status: 'FREEZE' },
            `${creature.creatureDefinitionId} is frozen solid!`);
        return false;
    }

    if (creature.status === 'PARALYSIS') {
        // 25% chance to be fully paralyzed
        if (rng.chance(25)) {
            addEvent(state, player, 'STATUS_APPLIED',
                { status: 'PARALYSIS' },
                `${creature.creatureDefinitionId} is fully paralyzed!`);
            return false;
        }
    }

    return true;
}

// ============================================
// SWITCH EXECUTION
// ============================================

function executeSwitch(
    state: BattleState,
    playerSide: PlayerSide,
    action: ResolvedAction
): void {
    if (!action.switchToInstanceId || !playerSide.active) return;

    const benchIndex = playerSide.bench.findIndex(
        c => c.instanceId === action.switchToInstanceId && !c.isFainted
    );

    if (benchIndex === -1) return;

    const oldActive = playerSide.active;
    const newActive = playerSide.bench[benchIndex];

    // Swap
    playerSide.active = newActive;
    playerSide.bench[benchIndex] = oldActive;

    addEvent(state, action.player, 'SWITCH',
        { from: oldActive.creatureDefinitionId, to: newActive.creatureDefinitionId },
        `${oldActive.creatureDefinitionId} switched out for ${newActive.creatureDefinitionId}!`);
}

// ============================================
// MOVE EXECUTION
// ============================================

function executeMove(
    state: BattleState,
    attackerSide: PlayerSide,
    defenderSide: PlayerSide,
    action: ResolvedAction,
    rng: Rng
): void {
    const attacker = attackerSide.active;
    const defender = defenderSide.active;

    if (!attacker || !defender || !action.move) return;

    const move = action.move;

    addEvent(state, action.player, 'MOVE_USED',
        { move: move.id },
        `${attacker.creatureDefinitionId} used ${move.name}!`);

    // Set cooldown for the move
    if (move.cooldown > 0) {
        attacker.moveCooldowns[move.id] = move.cooldown;
    }

    // Accuracy check (accuracy 0 means always hits)
    if (move.accuracy > 0 && move.accuracy < 100) {
        if (!rng.chance(move.accuracy)) {
            addEvent(state, action.player, 'MISS',
                { move: move.id },
                `${attacker.creatureDefinitionId}'s attack missed!`);
            return;
        }
    }

    // Status moves
    if (move.category === 'STATUS') {
        if (move.statusEffect && move.statusEffect !== 'NONE') {
            applyStatus(state, defender, move.statusEffect, action.player === 1 ? 2 : 1, rng);
        }
        return;
    }

    // Damage calculation
    const damage = calculateDamage(attacker, defender, move, state, action.player, rng);

    // Apply damage
    defender.currentHp = Math.max(0, defender.currentHp - damage.total);

    addEvent(state, action.player, 'DAMAGE',
        { damage: damage.total, remaining: defender.currentHp },
        `${defender.creatureDefinitionId} took ${damage.total} damage!`);

    // Check for faint
    if (defender.currentHp <= 0) {
        defender.isFainted = true;
        handleFaint(state, defenderSide, action.player === 1 ? 2 : 1);
    }

    // Apply status effect from move
    if (move.statusEffect && move.statusEffect !== 'NONE' && !defender.isFainted) {
        const statusChance = (move.statusChance ?? 0) * 100;
        if (rng.chance(statusChance)) {
            applyStatus(state, defender, move.statusEffect, action.player === 1 ? 2 : 1, rng);
        }
    }
}

// ============================================
// DAMAGE CALCULATION
// ============================================

interface DamageResult {
    total: number;
    effectiveness: number;
}

function calculateDamage(
    attacker: CreatureInstance,
    defender: CreatureInstance,
    move: MoveDefinition,
    state: BattleState,
    attackerPlayer: 1 | 2,
    rng: Rng
): DamageResult {
    // Get defender's element type from definition (simplified - use first known move's element)
    // In a full implementation, we'd look up the CreatureDefinition
    const defenderType = getCreatureElementType(defender);

    // Type effectiveness
    const effectiveness = getTypeEffectiveness(move.elementType, defenderType);

    if (effectiveness === 0) {
        addEvent(state, attackerPlayer, 'NO_EFFECT', {},
            `It doesn't affect ${defender.creatureDefinitionId}...`);
        return { total: 0, effectiveness: 0 };
    }

    if (effectiveness > 1) {
        addEvent(state, attackerPlayer, 'SUPER_EFFECTIVE', {},
            `It's super effective!`);
    } else if (effectiveness < 1) {
        addEvent(state, attackerPlayer, 'NOT_EFFECTIVE', {},
            `It's not very effective...`);
    }

    // Get attack stat (burn halves physical attack)
    let attackStat = attacker.atk;
    if (attacker.status === 'BURN' && move.category === 'PHYSICAL') {
        attackStat = Math.floor(attackStat / 2);
    }

    // Defense stat
    const defStat = Math.max(1, defender.def);

    // Damage formula: basePower * (atk / def) * typeMultiplier
    const baseDamage = move.basePower * (attackStat / defStat) * effectiveness;

    // Random variance (85-100%)
    const variance = 0.85 + (rng.next() * 0.15);

    const totalDamage = Math.floor(baseDamage * variance);

    // Minimum 1 damage if hit and not immune
    return {
        total: Math.max(1, totalDamage),
        effectiveness,
    };
}

/**
 * Simple heuristic to get creature element type.
 * In production, this should look up CreatureDefinition.
 */
function getCreatureElementType(creature: CreatureInstance): ElementType {
    // Check if creature ID contains element hint
    const id = creature.creatureDefinitionId.toLowerCase();
    if (id.includes('fire') || id.includes('flame')) return 'FIRE';
    if (id.includes('water') || id.includes('aqua')) return 'WATER';
    if (id.includes('grass') || id.includes('forest') || id.includes('thorn')) return 'GRASS';
    if (id.includes('electric') || id.includes('spark') || id.includes('thunder')) return 'ELECTRIC';
    if (id.includes('ice') || id.includes('frost') || id.includes('glacier')) return 'ICE';
    if (id.includes('earth') || id.includes('stone') || id.includes('sand')) return 'EARTH';
    if (id.includes('dark') || id.includes('shadow') || id.includes('nightmare')) return 'DARK';
    if (id.includes('light') || id.includes('holy') || id.includes('celestial')) return 'LIGHT';
    return 'NEUTRAL';
}

// ============================================
// STATUS EFFECTS
// ============================================

function applyStatus(
    state: BattleState,
    target: CreatureInstance,
    statusType: StatusEffectType,
    targetPlayer: 1 | 2,
    rng: Rng
): void {
    // Can't apply status if already has one (except NONE)
    if (target.status !== 'NONE') {
        return;
    }

    target.status = statusType;
    target.statusCounter = 0;

    // Set sleep duration (1-3 turns)
    if (statusType === 'SLEEP') {
        target.statusTurnsRemaining = rng.nextInt(1, 3);
    }

    // Set shield duration
    if (statusType === 'SHIELD') {
        target.statusTurnsRemaining = 3;
    }

    addEvent(state, targetPlayer, 'STATUS_APPLIED',
        { status: statusType },
        `${target.creatureDefinitionId} was inflicted with ${statusType}!`);
}

// ============================================
// END OF TURN EFFECTS
// ============================================

function applyEndOfTurnEffects(state: BattleState, rng: Rng): void {
    applyStatusDamage(state, state.player1, 1);
    applyStatusDamage(state, state.player2, 2);
}

function applyStatusDamage(state: BattleState, side: PlayerSide, player: 1 | 2): void {
    const creature = side.active;
    if (!creature || creature.isFainted) return;

    let damage = 0;

    switch (creature.status) {
        case 'BURN':
            damage = Math.max(1, Math.floor(creature.maxHp / 16)); // 1/16 max HP
            break;
        case 'POISON':
            damage = Math.max(1, Math.floor(creature.maxHp / 8)); // 1/8 max HP
            break;
    }

    if (damage > 0) {
        creature.currentHp = Math.max(0, creature.currentHp - damage);
        addEvent(state, player, 'STATUS_DAMAGE',
            { status: creature.status, damage },
            `${creature.creatureDefinitionId} is hurt by ${creature.status}!`);

        if (creature.currentHp <= 0) {
            creature.isFainted = true;
            handleFaint(state, side, player);
        }
    }

    // Decrement status turns for SHIELD
    if (creature.status === 'SHIELD' && creature.statusTurnsRemaining !== undefined) {
        creature.statusTurnsRemaining--;
        if (creature.statusTurnsRemaining <= 0) {
            creature.status = 'NONE';
            addEvent(state, player, 'STATUS_EXPIRED',
                { status: 'SHIELD' },
                `${creature.creatureDefinitionId}'s shield faded!`);
        }
    }
}

// ============================================
// FAINT HANDLING
// ============================================

function handleFaint(state: BattleState, side: PlayerSide, player: 1 | 2): void {
    const fainted = side.active;
    if (!fainted) return;

    addEvent(state, player, 'FAINT', {},
        `${fainted.creatureDefinitionId} fainted!`);

    // Move to fallen
    side.fallen.push(fainted);

    // Auto-switch to first available bench creature
    const availableBench = side.bench.filter(c => !c.isFainted);

    if (availableBench.length > 0) {
        const replacement = availableBench[0];
        const benchIndex = side.bench.findIndex(c => c.instanceId === replacement.instanceId);

        side.active = replacement;
        side.bench.splice(benchIndex, 1);

        addEvent(state, player, 'SWITCH',
            { from: fainted.creatureDefinitionId, to: replacement.creatureDefinitionId },
            `${replacement.creatureDefinitionId} was sent out!`);
    } else {
        side.active = null;
    }
}

// ============================================
// COOLDOWN MANAGEMENT
// ============================================

function tickAllCooldowns(state: BattleState): void {
    tickSideCooldowns(state.player1);
    tickSideCooldowns(state.player2);
}

function tickSideCooldowns(side: PlayerSide): void {
    if (side.active) tickCreatureCooldowns(side.active);
    side.bench.forEach(tickCreatureCooldowns);
}

function tickCreatureCooldowns(creature: CreatureInstance): void {
    for (const moveId of Object.keys(creature.moveCooldowns)) {
        if (creature.moveCooldowns[moveId] > 0) {
            creature.moveCooldowns[moveId]--;
        }
    }
}

// ============================================
// WIN CONDITION CHECK
// ============================================

function checkWinCondition(state: BattleState): void {
    const p1HasAlive = hasAlivecreatures(state.player1);
    const p2HasAlive = hasAlivecreatures(state.player2);

    if (!p1HasAlive && !p2HasAlive) {
        state.result = 'DRAW';
    } else if (!p1HasAlive) {
        state.result = 'PLAYER2_WIN';
    } else if (!p2HasAlive) {
        state.result = 'PLAYER1_WIN';
    }
    // Otherwise stays 'ONGOING'
}

function hasAlivecreatures(side: PlayerSide): boolean {
    if (side.active && !side.active.isFainted) return true;
    return side.bench.some(c => !c.isFainted);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function addEvent(
    state: BattleState,
    sourcePlayer: 1 | 2,
    type: BattleEventType,
    payload: Record<string, unknown>,
    description: string
): void {
    const event: BattleEvent = {
        turn: state.turnNumber,
        sourcePlayer,
        type,
        payload,
        description,
    };
    state.lastTurnEvents.push(event);
}

// ============================================
// BATTLE INITIALIZATION HELPER
// ============================================

/**
 * Creates an initial BattleState from two teams.
 */
export function createInitialBattleState(
    battleId: string,
    seed: number,
    player1Id: string,
    player2Id: string,
    player1Team: CreatureInstance[],
    player2Team: CreatureInstance[]
): BattleState {
    if (player1Team.length === 0 || player2Team.length === 0) {
        throw new Error('Teams must have at least one creature');
    }

    return {
        id: battleId,
        seed,
        turnNumber: 0,
        phase: 'WAITING_FOR_ACTIONS',
        result: 'ONGOING',
        player1: {
            playerId: player1Id,
            active: cloneCreature(player1Team[0]),
            bench: player1Team.slice(1).map(cloneCreature),
            fallen: [],
            lineupDefinitionIds: player1Team.map(c => c.creatureDefinitionId),
        },
        player2: {
            playerId: player2Id,
            active: cloneCreature(player2Team[0]),
            bench: player2Team.slice(1).map(cloneCreature),
            fallen: [],
            lineupDefinitionIds: player2Team.map(c => c.creatureDefinitionId),
        },
        lastTurnEvents: [],
    };
}

/**
 * Creates a CreatureInstance from base stats (for testing/setup).
 */
export function createCreatureInstance(
    instanceId: string,
    definitionId: string,
    stats: {
        hp: number;
        atk: number;
        def: number;
        spd: number;
    },
    knownMoveIds: string[]
): CreatureInstance {
    return {
        instanceId,
        creatureDefinitionId: definitionId,
        currentHp: stats.hp,
        maxHp: stats.hp,
        atk: stats.atk,
        def: stats.def,
        spd: stats.spd,
        status: 'NONE',
        statusTurnsRemaining: 0,
        statusCounter: 0,
        isFainted: false,
        moveCooldowns: {},
        knownMoveIds,
    };
}
