import {
    MatchSetup,
    MatchResult,
    MatchEvent,
    UnitState,
    UnitDefinition,
    EquipmentDefinition,
    PlayerUnitInstance,
    MatchWinner,
    ActiveEffect,
    UNIT_BY_ID,
    EQUIPMENT_BY_ID,
} from '@nft-autobattler/shared-types';
import { createRng, Rng } from './rng.js';

const MAX_TURNS = 100;
const DAMAGE_VARIANCE = 1; // ±1 damage

interface BattleUnit extends UnitState {
    definition: UnitDefinition;
    equipment: EquipmentDefinition[];
    hasActedThisTurn: boolean;
    hasBeenHitThisMatch: boolean;
    hasRevived: boolean;
    turnsActive: number;
}

interface BattleState {
    units: BattleUnit[];
    events: MatchEvent[];
    turnIndex: number;
    rng: Rng;
}

/**
 * Main battle simulation function
 * Takes a match setup and returns the complete result with event log
 */
export function simulateBattle(setup: MatchSetup): MatchResult {
    const rng = createRng(setup.seed);

    // Initialize battle state
    const state: BattleState = {
        units: [],
        events: [],
        turnIndex: 0,
        rng,
    };

    // Create battle units from setup
    const teamAUnits = createBattleUnits(setup.teamA, setup.equipmentMap, 'teamA');
    const teamBUnits = createBattleUnits(setup.teamB, setup.equipmentMap, 'teamB');
    state.units = [...teamAUnits, ...teamBUnits];

    // Apply team-wide buffs (e.g., War Banner)
    applyTeamBuffs(state);

    // Main battle loop
    while (state.turnIndex < MAX_TURNS) {
        const result = executeTurn(state);
        if (result) {
            return createMatchResult(setup.matchId, result, state);
        }
        state.turnIndex++;
    }

    // Max turns reached - draw
    return createMatchResult(setup.matchId, 'draw', state);
}

function createBattleUnits(
    instances: PlayerUnitInstance[],
    equipmentMap: Record<string, { instanceId: string; equipmentDefinitionId: string }>,
    team: 'teamA' | 'teamB'
): BattleUnit[] {
    return instances.map((instance, slotIndex) => {
        const definition = UNIT_BY_ID[instance.unitDefinitionId];
        if (!definition) {
            throw new Error(`Unknown unit definition: ${instance.unitDefinitionId}`);
        }

        // Get equipped items
        const equipment: EquipmentDefinition[] = instance.equippedItems
            .map((equipInstanceId) => {
                const equipInstance = equipmentMap[equipInstanceId];
                if (!equipInstance) return null;
                return EQUIPMENT_BY_ID[equipInstance.equipmentDefinitionId];
            })
            .filter((e): e is EquipmentDefinition => e !== null);

        // Calculate stats with equipment bonuses
        let hp = definition.baseHp;
        let atk = definition.baseAtk;
        let spd = definition.baseSpd;

        for (const equip of equipment) {
            hp += equip.bonusHp;
            atk += equip.bonusAtk;
            spd += equip.bonusSpd;
        }

        // Apply passive: hp_boost_when_equipped
        if (definition.passiveType === 'hp_boost_when_equipped' && equipment.length > 0) {
            const boost = definition.passiveParams.percentBoost || 0;
            hp = Math.floor(hp * (1 + boost / 100));
        }

        return {
            instanceId: instance.instanceId,
            unitDefinitionId: instance.unitDefinitionId,
            currentHp: hp,
            maxHp: hp,
            atk,
            spd,
            isAlive: true,
            team,
            slotIndex,
            effects: [],
            definition,
            equipment,
            hasActedThisTurn: false,
            hasBeenHitThisMatch: false,
            hasRevived: false,
            turnsActive: 0,
        };
    });
}

function applyTeamBuffs(state: BattleState): void {
    // Check for War Banner effect
    for (const unit of state.units) {
        for (const equip of unit.equipment) {
            if (equip.effectType === 'team_atk_buff') {
                const bonus = equip.effectParams.atkBonus || 0;
                const teammates = state.units.filter((u) => u.team === unit.team);
                for (const teammate of teammates) {
                    teammate.atk += bonus;
                }
                state.events.push({
                    turnIndex: 0,
                    actorInstanceId: unit.instanceId,
                    targetInstanceId: null,
                    eventType: 'effect_trigger',
                    value: bonus,
                    description: `${unit.definition.name}'s ${equip.name} grants +${bonus} ATK to team`,
                });
            }
        }
    }
}

function executeTurn(state: BattleState): MatchWinner | null {
    // Sort units by speed (descending), with slot index as tiebreaker
    const turnOrder = [...state.units]
        .filter((u) => u.isAlive)
        .sort((a, b) => {
            if (b.spd !== a.spd) return b.spd - a.spd;
            // Tiebreaker: team A goes first, then by slot
            if (a.team !== b.team) return a.team === 'teamA' ? -1 : 1;
            return a.slotIndex - b.slotIndex;
        });

    // Reset turn flags
    for (const unit of state.units) {
        unit.hasActedThisTurn = false;
    }

    // Each unit takes their action
    for (const actor of turnOrder) {
        if (!actor.isAlive) continue;

        // Apply speed boost first turn passive
        if (state.turnIndex === 0 && actor.definition.passiveType === 'speed_boost_first_turn') {
            const boost = actor.definition.passiveParams.percentBoost || 0;
            actor.spd = Math.floor(actor.spd * (1 + boost / 100));
        }

        // Apply ATK per turn passive
        if (actor.definition.passiveType === 'atk_per_turn') {
            const gain = actor.definition.passiveParams.atkGain || 0;
            actor.atk += gain;
            if (actor.turnsActive > 0) {
                state.events.push({
                    turnIndex: state.turnIndex,
                    actorInstanceId: actor.instanceId,
                    targetInstanceId: null,
                    eventType: 'passive_trigger',
                    value: gain,
                    description: `${actor.definition.name} gains +${gain} ATK (Berserker)`,
                });
            }
        }

        actor.turnsActive++;

        // Perform attack
        const attackResult = performAttack(actor, state);
        if (attackResult) return attackResult;

        // Check for double action
        if (actor.definition.passiveType === 'double_action_chance') {
            const chance = actor.definition.passiveParams.chancePercent || 0;
            if (state.rng.chance(chance)) {
                state.events.push({
                    turnIndex: state.turnIndex,
                    actorInstanceId: actor.instanceId,
                    targetInstanceId: null,
                    eventType: 'passive_trigger',
                    value: 0,
                    description: `${actor.definition.name} acts again! (Time Wizard)`,
                });
                const secondResult = performAttack(actor, state);
                if (secondResult) return secondResult;
            }
        }

        actor.hasActedThisTurn = true;
    }

    return null;
}

function performAttack(actor: BattleUnit, state: BattleState): MatchWinner | null {
    // Find valid targets
    const enemies = state.units.filter((u) => u.team !== actor.team && u.isAlive);
    if (enemies.length === 0) {
        return actor.team === 'teamA' ? 'teamA' : 'teamB';
    }

    // Pick random target
    const target = state.rng.pick(enemies);

    // Calculate base damage with variance
    let damage = actor.atk + state.rng.nextInt(-DAMAGE_VARIANCE, DAMAGE_VARIANCE);

    // Apply damage vs low HP passive
    if (actor.definition.passiveType === 'damage_vs_low_hp') {
        const threshold = actor.definition.passiveParams.thresholdPercent || 50;
        const bonus = actor.definition.passiveParams.bonusAtk || 0;
        if ((target.currentHp / target.maxHp) * 100 < threshold) {
            damage += bonus;
        }
    }

    // Apply damage boost when own HP is low
    if (actor.definition.passiveType === 'damage_boost_low_hp') {
        const threshold = actor.definition.passiveParams.thresholdPercent || 50;
        const boost = actor.definition.passiveParams.percentBoost || 0;
        if ((actor.currentHp / actor.maxHp) * 100 < threshold) {
            damage = Math.floor(damage * (1 + boost / 100));
        }
    }

    // Apply first hit bonus from equipment
    if (!actor.hasActedThisTurn) {
        for (const equip of actor.equipment) {
            if (equip.effectType === 'first_hit_bonus') {
                damage += equip.effectParams.bonusDamage || 0;
            }
        }
    }

    // Log attack
    state.events.push({
        turnIndex: state.turnIndex,
        actorInstanceId: actor.instanceId,
        targetInstanceId: target.instanceId,
        eventType: 'attack',
        value: damage,
        description: `${actor.definition.name} attacks ${target.definition.name}`,
    });

    // Check for immunity to first hit
    if (!target.hasBeenHitThisMatch && target.definition.passiveType === 'immune_first_hit') {
        target.hasBeenHitThisMatch = true;
        state.events.push({
            turnIndex: state.turnIndex,
            actorInstanceId: target.instanceId,
            targetInstanceId: null,
            eventType: 'passive_trigger',
            value: 0,
            description: `${target.definition.name} blocks the first hit! (Void Knight)`,
        });
        return null;
    }

    target.hasBeenHitThisMatch = true;

    // Check for dodge
    for (const equip of target.equipment) {
        if (equip.effectType === 'dodge_chance') {
            const chance = equip.effectParams.chancePercent || 0;
            if (state.rng.chance(chance)) {
                state.events.push({
                    turnIndex: state.turnIndex,
                    actorInstanceId: target.instanceId,
                    targetInstanceId: null,
                    eventType: 'dodge',
                    value: 0,
                    description: `${target.definition.name} dodges the attack!`,
                });
                return null;
            }
        }
    }

    // Check for block (from passive or equipment)
    let blocked = false;
    if (target.definition.passiveType === 'block_chance') {
        const chance = target.definition.passiveParams.chancePercent || 0;
        const block = target.definition.passiveParams.blockAmount || 0;
        if (state.rng.chance(chance)) {
            damage = Math.max(0, damage - block);
            blocked = true;
        }
    }
    for (const equip of target.equipment) {
        if (equip.effectType === 'block_chance') {
            const chance = equip.effectParams.chancePercent || 0;
            const block = equip.effectParams.blockAmount || 0;
            if (state.rng.chance(chance)) {
                damage = Math.max(0, damage - block);
                blocked = true;
            }
        }
    }

    if (blocked) {
        state.events.push({
            turnIndex: state.turnIndex,
            actorInstanceId: target.instanceId,
            targetInstanceId: null,
            eventType: 'block',
            value: 1,
            description: `${target.definition.name} blocks some damage!`,
        });
    }

    // Apply damage
    target.currentHp -= damage;
    state.events.push({
        turnIndex: state.turnIndex,
        actorInstanceId: actor.instanceId,
        targetInstanceId: target.instanceId,
        eventType: 'damage',
        value: damage,
        description: `${target.definition.name} takes ${damage} damage (${Math.max(0, target.currentHp)}/${target.maxHp} HP)`,
    });

    // Apply lifesteal from passive
    if (actor.definition.passiveType === 'lifesteal') {
        const percent = actor.definition.passiveParams.percentHeal || 0;
        const heal = Math.floor((damage * percent) / 100);
        if (heal > 0) {
            actor.currentHp = Math.min(actor.maxHp, actor.currentHp + heal);
            state.events.push({
                turnIndex: state.turnIndex,
                actorInstanceId: actor.instanceId,
                targetInstanceId: null,
                eventType: 'heal',
                value: heal,
                description: `${actor.definition.name} heals for ${heal} HP (lifesteal)`,
            });
        }
    }

    // Apply lifesteal from equipment
    for (const equip of actor.equipment) {
        if (equip.effectType === 'lifesteal') {
            const percent = equip.effectParams.percentHeal || 0;
            const heal = Math.floor((damage * percent) / 100);
            if (heal > 0) {
                actor.currentHp = Math.min(actor.maxHp, actor.currentHp + heal);
                state.events.push({
                    turnIndex: state.turnIndex,
                    actorInstanceId: actor.instanceId,
                    targetInstanceId: null,
                    eventType: 'heal',
                    value: heal,
                    description: `${actor.definition.name} heals for ${heal} HP (${equip.name})`,
                });
            }
        }
    }

    // Apply slow effect
    if (actor.definition.passiveType === 'slow_target') {
        const reduction = actor.definition.passiveParams.spdReduction || 0;
        target.spd = Math.max(1, target.spd - reduction);
        state.events.push({
            turnIndex: state.turnIndex,
            actorInstanceId: actor.instanceId,
            targetInstanceId: target.instanceId,
            eventType: 'effect_trigger',
            value: reduction,
            description: `${target.definition.name} is slowed by ${reduction} SPD`,
        });
    }

    // Apply AoE splash
    if (actor.definition.passiveType === 'aoe_splash') {
        const splash = actor.definition.passiveParams.splashDamage || 0;
        const otherEnemies = enemies.filter((e) => e.instanceId !== target.instanceId);
        for (const enemy of otherEnemies) {
            enemy.currentHp -= splash;
            state.events.push({
                turnIndex: state.turnIndex,
                actorInstanceId: actor.instanceId,
                targetInstanceId: enemy.instanceId,
                eventType: 'damage',
                value: splash,
                description: `${enemy.definition.name} takes ${splash} splash damage`,
            });
            // Check for splash kill
            if (enemy.currentHp <= 0) {
                const deathResult = handleDeath(enemy, actor, state);
                if (deathResult) return deathResult;
            }
        }
    }

    // Check for death
    if (target.currentHp <= 0) {
        const deathResult = handleDeath(target, actor, state);
        if (deathResult) return deathResult;
    }

    return null;
}

function handleDeath(target: BattleUnit, killer: BattleUnit, state: BattleState): MatchWinner | null {
    // Check for Phoenix Feather revive
    if (!target.hasRevived) {
        for (const equip of target.equipment) {
            if (equip.effectType === 'revive') {
                const hpPercent = equip.effectParams.reviveHpPercent || 20;
                target.currentHp = Math.floor((target.maxHp * hpPercent) / 100);
                target.hasRevived = true;
                state.events.push({
                    turnIndex: state.turnIndex,
                    actorInstanceId: target.instanceId,
                    targetInstanceId: null,
                    eventType: 'revive',
                    value: target.currentHp,
                    description: `${target.definition.name} is revived by ${equip.name}! (${target.currentHp} HP)`,
                });
                return null;
            }
        }
    }

    // Unit dies
    target.isAlive = false;
    target.currentHp = 0;
    state.events.push({
        turnIndex: state.turnIndex,
        actorInstanceId: target.instanceId,
        targetInstanceId: null,
        eventType: 'death',
        value: 0,
        description: `${target.definition.name} has been defeated!`,
    });

    // Apply heal on kill passive
    if (killer.definition.passiveType === 'heal_on_kill') {
        const heal = killer.definition.passiveParams.healAmount || 0;
        killer.currentHp = Math.min(killer.maxHp, killer.currentHp + heal);
        state.events.push({
            turnIndex: state.turnIndex,
            actorInstanceId: killer.instanceId,
            targetInstanceId: null,
            eventType: 'heal',
            value: heal,
            description: `${killer.definition.name} heals for ${heal} HP (Holy Knight)`,
        });
    }

    // Check for team wipe
    const teamAAlive = state.units.some((u) => u.team === 'teamA' && u.isAlive);
    const teamBAlive = state.units.some((u) => u.team === 'teamB' && u.isAlive);

    if (!teamAAlive) return 'teamB';
    if (!teamBAlive) return 'teamA';

    return null;
}

function createMatchResult(
    matchId: string,
    winner: MatchWinner,
    state: BattleState
): MatchResult {
    // Add match end event
    state.events.push({
        turnIndex: state.turnIndex,
        actorInstanceId: null,
        targetInstanceId: null,
        eventType: 'match_end',
        value: 0,
        description: winner === 'draw' ? 'Match ended in a draw!' : `${winner} wins!`,
    });

    // Create final state
    const toUnitState = (u: BattleUnit): UnitState => ({
        instanceId: u.instanceId,
        unitDefinitionId: u.unitDefinitionId,
        currentHp: Math.max(0, u.currentHp),
        maxHp: u.maxHp,
        atk: u.atk,
        spd: u.spd,
        isAlive: u.isAlive,
        team: u.team,
        slotIndex: u.slotIndex,
        effects: u.effects,
    });

    return {
        matchId,
        winner,
        events: state.events,
        totalTurns: state.turnIndex + 1,
        finalState: {
            teamA: state.units.filter((u) => u.team === 'teamA').map(toUnitState),
            teamB: state.units.filter((u) => u.team === 'teamB').map(toUnitState),
        },
    };
}
