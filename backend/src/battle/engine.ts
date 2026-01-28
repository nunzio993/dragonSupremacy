/**
 * Battle Engine Core
 * Deterministic 1v1 battle simulation
 */

import { DeterministicRNG, createBattleSeed } from './rng.js';
import {
    BattleCreature,
    BattleState,
    BattleAction,
    TurnResult,
    ActionResult,
    Move
} from './types.js';
import { executeAttack, calculateMaxHp } from './damage.js';
import {
    processStatusEffects,
    checkCanAct,
    getEffectiveSpeed,
    tickCooldowns,
    getAvailableMoves,
    applyHeal,
    applyCleanse
} from './status.js';

/**
 * Initialize a new battle
 */
export function initializeBattle(
    battleId: string,
    seed: string,
    playerA: string,
    playerB: string,
    creatureA: BattleCreature,
    creatureB: BattleCreature
): BattleState {
    // Calculate max HP and set current HP
    creatureA.maxHp = calculateMaxHp(creatureA);
    creatureA.currentHp = creatureA.maxHp;
    creatureA.cooldowns = {};
    creatureA.statusEffects = [];

    creatureB.maxHp = calculateMaxHp(creatureB);
    creatureB.currentHp = creatureB.maxHp;
    creatureB.cooldowns = {};
    creatureB.statusEffects = [];

    // Calculate Power Rating (sum of all stats) - WEAKER attacks first!
    const getPowerRating = (c: BattleCreature) => {
        const attrs = c.attributes;
        return attrs.STR + attrs.AGI + attrs.SPD + attrs.REF +
            attrs.END + attrs.VIT + attrs.INT + attrs.PRC + attrs.RGN;
    };

    const powerA = getPowerRating(creatureA);
    const powerB = getPowerRating(creatureB);

    // Weaker creature (lower power) goes first
    const firstPlayer = powerA <= powerB ? playerA : playerB;

    return {
        battleId,
        seed,
        playerA,
        playerB,
        creatureA,
        creatureB,
        turnNumber: 1,
        currentTurnPlayer: firstPlayer,
        turnHistory: []
    };
}

/**
 * Execute a full turn with both players' actions
 */
export function executeTurn(
    state: BattleState,
    actionA: BattleAction,
    actionB: BattleAction
): TurnResult {
    const rng = new DeterministicRNG(state.seed + '|turn|' + state.turnNumber);

    const result: TurnResult = {
        turnNumber: state.turnNumber,
        actions: [],
        statusTicks: [],
        knockouts: []
    };

    // Get creatures
    const creatureA = state.creatureA;
    const creatureB = state.creatureB;

    // Determine action order (power rating + priority)
    // LOWER power goes first, but move priority still adds bonus
    const moveA = creatureA.moves.find(m => m.moveId === actionA.moveId)!;
    const moveB = creatureB.moves.find(m => m.moveId === actionB.moveId)!;

    // Calculate power rating
    const getPowerRating = (c: BattleCreature) => {
        const attrs = c.attributes;
        return attrs.STR + attrs.AGI + attrs.SPD + attrs.REF +
            attrs.END + attrs.VIT + attrs.INT + attrs.PRC + attrs.RGN;
    };

    // Lower power = attacks first (negative order value)
    // Priority adds bonus (negative because lower order goes first)
    const orderA = getPowerRating(creatureA) - (moveA.priority * 100);
    const orderB = getPowerRating(creatureB) - (moveB.priority * 100);

    // If same order, use RNG
    let firstAction: BattleAction;
    let secondAction: BattleAction;
    let firstCreature: BattleCreature;
    let secondCreature: BattleCreature;
    let firstMove: Move;
    let secondMove: Move;

    // Lower order value goes first (weaker creature)
    if (orderA < orderB || (orderA === orderB && rng.chance(0.5))) {
        firstAction = actionA;
        secondAction = actionB;
        firstCreature = creatureA;
        secondCreature = creatureB;
        firstMove = moveA;
        secondMove = moveB;
    } else {
        firstAction = actionB;
        secondAction = actionA;
        firstCreature = creatureB;
        secondCreature = creatureA;
        firstMove = moveB;
        secondMove = moveA;
    }

    // Execute first action
    const canActFirst = checkCanAct(rng, firstCreature);
    if (canActFirst.canAct) {
        const actionResult = executeAction(rng, firstCreature, secondCreature, firstMove);
        result.actions.push(actionResult);

        // Check for KO
        if (secondCreature.currentHp <= 0) {
            result.knockouts.push(secondCreature.id);
        }
    } else {
        // Creature couldn't act
        result.actions.push({
            attackerId: firstCreature.id,
            targetId: secondCreature.id,
            moveId: 'skip',
            moveName: `Skipped (${canActFirst.reason})`,
            hit: false,
            critical: false,
            damage: 0,
            attackerHpAfter: firstCreature.currentHp,
            targetHpAfter: secondCreature.currentHp
        });
    }

    // Execute second action (if not KO'd)
    if (secondCreature.currentHp > 0) {
        const canActSecond = checkCanAct(rng, secondCreature);
        if (canActSecond.canAct) {
            const actionResult = executeAction(rng, secondCreature, firstCreature, secondMove);
            result.actions.push(actionResult);

            // Check for KO
            if (firstCreature.currentHp <= 0) {
                result.knockouts.push(firstCreature.id);
            }
        } else {
            result.actions.push({
                attackerId: secondCreature.id,
                targetId: firstCreature.id,
                moveId: 'skip',
                moveName: `Skipped (${canActSecond.reason})`,
                hit: false,
                critical: false,
                damage: 0,
                attackerHpAfter: secondCreature.currentHp,
                targetHpAfter: firstCreature.currentHp
            });
        }
    }

    // Process end-of-turn status effects
    if (creatureA.currentHp > 0) {
        const ticksA = processStatusEffects(rng, creatureA);
        result.statusTicks.push(...ticksA);
        if (creatureA.currentHp <= 0) {
            result.knockouts.push(creatureA.id);
        }
    }

    if (creatureB.currentHp > 0) {
        const ticksB = processStatusEffects(rng, creatureB);
        result.statusTicks.push(...ticksB);
        if (creatureB.currentHp <= 0) {
            result.knockouts.push(creatureB.id);
        }
    }

    // Tick cooldowns
    tickCooldowns(creatureA);
    tickCooldowns(creatureB);

    // Save to history
    state.turnHistory.push(result);
    state.turnNumber++;

    // Check for winner
    if (creatureA.currentHp <= 0 && creatureB.currentHp <= 0) {
        // Both KO'd, whoever had more HP at start of turn wins
        // Or it's a draw (edge case)
        state.winner = undefined; // Draw
    } else if (creatureA.currentHp <= 0) {
        state.winner = state.playerB;
    } else if (creatureB.currentHp <= 0) {
        state.winner = state.playerA;
    }

    return result;
}

/**
 * Execute a single action (attack or status move)
 */
function executeAction(
    rng: DeterministicRNG,
    attacker: BattleCreature,
    defender: BattleCreature,
    move: Move
): ActionResult {
    // Handle special status moves
    if (move.category === 'STATUS') {
        return executeStatusMove(rng, attacker, defender, move);
    }

    // Regular attack
    return executeAttack(rng, attacker, defender, move);
}

/**
 * Execute status-only moves
 */
function executeStatusMove(
    rng: DeterministicRNG,
    attacker: BattleCreature,
    defender: BattleCreature,
    move: Move
): ActionResult {
    const result: ActionResult = {
        attackerId: attacker.id,
        targetId: defender.id,
        moveId: move.moveId,
        moveName: move.name,
        hit: true,
        critical: false,
        damage: 0,
        attackerHpAfter: attacker.currentHp,
        targetHpAfter: defender.currentHp
    };

    // Set cooldown
    if (move.cooldownMax > 0) {
        attacker.cooldowns[move.moveId] = move.cooldownMax;
    }

    // Handle specific moves
    switch (move.moveId) {
        case 'healing_rain':
            applyHeal(attacker, 0.30);
            result.attackerHpAfter = attacker.currentHp;
            break;

        case 'purify':
            applyCleanse(attacker);
            result.attackerHpAfter = attacker.currentHp;
            break;

        case 'flame_shield':
        case 'frost_armor':
        case 'stone_wall':
            // Buff moves - TODO: implement buff system
            // For now, just apply a defensive boost via status
            break;

        case 'leech_seed':
        case 'nightmare':
            // Apply status to defender
            if (move.statusEffect && rng.chance(move.statusChance)) {
                defender.statusEffects.push({
                    type: move.statusEffect,
                    turnsRemaining: move.statusDuration ?? 2,
                    sourceId: attacker.id
                });
                result.statusApplied = move.statusEffect;
            }
            break;

        default:
            // Generic status application
            if (move.statusEffect && rng.chance(move.statusChance)) {
                defender.statusEffects.push({
                    type: move.statusEffect,
                    turnsRemaining: move.statusDuration ?? 2,
                    sourceId: attacker.id
                });
                result.statusApplied = move.statusEffect;
            }
            break;
    }

    return result;
}

/**
 * Get the current state for a player
 */
export function getPlayerView(state: BattleState, playerId: string): BattleState {
    // Return full state for now (no hidden info)
    return state;
}

/**
 * Check if battle is over
 */
export function isBattleOver(state: BattleState): boolean {
    return state.winner !== undefined ||
        state.forfeit !== undefined ||
        state.creatureA.currentHp <= 0 ||
        state.creatureB.currentHp <= 0;
}

/**
 * Get available moves for a creature
 */
export function getCreatureAvailableMoves(state: BattleState, creatureId: string) {
    const creature = state.creatureA.id === creatureId
        ? state.creatureA
        : state.creatureB;
    return getAvailableMoves(creature);
}

/**
 * Handle player timeout (auto-select first available move)
 */
export function getTimeoutAction(state: BattleState, playerId: string): BattleAction {
    const creature = state.playerA === playerId
        ? state.creatureA
        : state.creatureB;
    const opponent = state.playerA === playerId
        ? state.creatureB
        : state.creatureA;

    const availableMoves = getAvailableMoves(creature);
    const move = availableMoves[0] || creature.moves[0];

    return {
        creatureId: creature.id,
        moveId: move.moveId,
        targetId: opponent.id
    };
}

/**
 * Handle forfeit
 */
export function forfeitBattle(state: BattleState, playerId: string): void {
    state.forfeit = playerId;
    state.winner = state.playerA === playerId ? state.playerB : state.playerA;
}
