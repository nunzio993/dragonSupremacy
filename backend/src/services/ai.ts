/**
 * AI Service for Turn-Based Battles
 * 
 * Provides AI opponent logic for PvE battles.
 */

import {
    BattleState,
    PlayerAction,
    CreatureInstance,
    CreatureDefinition,
    CREATURE_BY_ID,
} from '@nft-autobattler/shared-types';
import { createCreatureInstance } from '@nft-autobattler/game-engine';

// ============================================
// AI TEAM GENERATION
// ============================================

/**
 * AI creature templates by difficulty level
 */
const AI_TEMPLATES = {
    easy: [
        { definitionId: 'common_slime', moves: ['tackle', 'slam'] },
        { definitionId: 'spark_mouse', moves: ['thunder_shock', 'quick_strike'] },
        { definitionId: 'common_slime', moves: ['tackle', 'toxic'] },
    ],
    medium: [
        { definitionId: 'flame_lizard', moves: ['ember', 'flamethrower', 'quick_strike'] },
        { definitionId: 'aqua_turtle', moves: ['water_gun', 'aqua_jet', 'ice_beam'] },
        { definitionId: 'forest_dino', moves: ['vine_whip', 'razor_leaf', 'sleep_powder'] },
    ],
    hard: [
        { definitionId: 'fire_hound', moves: ['flamethrower', 'inferno', 'dark_pulse', 'quick_strike'] },
        { definitionId: 'thunder_bird', moves: ['thunderbolt', 'ice_beam', 'thunder_wave'] },
        { definitionId: 'sand_dragon', moves: ['earthquake', 'flamethrower', 'rock_slide'] },
    ],
};

export type AIDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Generates an AI team based on difficulty.
 */
export function generateAITeam(difficulty: AIDifficulty = 'easy'): CreatureInstance[] {
    const templates = AI_TEMPLATES[difficulty];

    return templates.map((template, index) => {
        const definition = CREATURE_BY_ID[template.definitionId];

        if (!definition) {
            // Fallback to a basic creature
            return createCreatureInstance(
                `ai-creature-${index}`,
                'common_slime',
                { hp: 70, atk: 50, def: 50, spd: 40 },
                ['tackle', 'slam']
            );
        }

        return createCreatureInstance(
            `ai-creature-${index}`,
            definition.id,
            {
                hp: definition.baseHp,
                atk: definition.baseAtk,
                def: definition.baseDef,
                spd: definition.baseSpd,
            },
            template.moves
        );
    });
}

// ============================================
// AI ACTION GENERATION
// ============================================

/**
 * Generates an AI action based on the current battle state.
 * 
 * Strategy:
 * - If HP < 25% and has alive bench creature, 30% chance to switch
 * - Otherwise, use the first available move (no cooldown)
 */
export function generateAIAction(state: BattleState): PlayerAction {
    const aiSide = state.player2;
    const active = aiSide.active;

    if (!active || active.isFainted) {
        // No valid action possible - should not happen in normal flow
        return {
            playerId: aiSide.playerId,
            type: 'USE_MOVE',
            moveId: 'tackle',
        };
    }

    // Check if HP is low and we have bench creatures
    const hpPercent = (active.currentHp / active.maxHp) * 100;
    const aliveBench = aiSide.bench.filter(c => !c.isFainted);

    if (hpPercent < 25 && aliveBench.length > 0) {
        // 30% chance to switch
        if (Math.random() < 0.3) {
            return {
                playerId: aiSide.playerId,
                type: 'SWITCH',
                switchToInstanceId: aliveBench[0].instanceId,
            };
        }
    }

    // Use first available move (not on cooldown)
    const availableMove = active.knownMoveIds.find(moveId => {
        const cooldown = active.moveCooldowns[moveId] || 0;
        return cooldown <= 0;
    });

    return {
        playerId: aiSide.playerId,
        type: 'USE_MOVE',
        moveId: availableMove || active.knownMoveIds[0] || 'tackle',
        targetPlayer: 1,
    };
}

// ============================================
// AI PLAYER ID
// ============================================

export const AI_PLAYER_ID = 'ai-opponent';
