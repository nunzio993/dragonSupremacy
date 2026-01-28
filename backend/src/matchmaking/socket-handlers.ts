/**
 * Socket Handlers
 * WebSocket event handlers for matchmaking and battle
 */

import { Server, Socket } from 'socket.io';
import {
    ClientToServerEvents,
    ServerToClientEvents,
    CreateRoomData,
    JoinRoomData,
    StakeConfirmedData,
    SubmitActionData,
    BattleStartData,
    WaitingForActionData,
    TurnUpdateData,
    BattleEndData,
    Room
} from './types.js';
import * as RoomManager from './room-manager.js';
import {
    initializeBattle,
    executeTurn,
    isBattleOver,
    getAvailableMoves,
    getTimeoutAction,
    forfeitBattle,
    BattleCreature,
    BattleAction,
    BattleState
} from '../battle/index.js';
import { DeterministicRNG } from '../battle/rng.js';
import { executeAttack, calculateSpeed, calculateRegeneration, calculateMaxHp } from '../battle/damage.js';
import { xpService, XP_REWARDS } from '../services/xp-service.js';
import { creatureFetcher } from '../services/creature-fetcher.js';
import { rewardBattleWinner } from '../services/battle-reward-service.js';
import { battleGateV2Service } from '../services/battle-gate-v2-service.js';

// Type for our socket
type BattleSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Turn timeout (60 seconds)
const TURN_TIMEOUT_MS = 60000;

// Active timeouts per room
const turnTimeouts = new Map<string, NodeJS.Timeout>();

// Socket ID to player ID mapping
const socketToPlayer = new Map<string, string>();

/**
 * Calculate total stats for a creature (used for turn order)
 * Lower total = weaker = attacks first
 */
function calculateTotalStats(creature: BattleCreature): number {
    const attrs = creature.attributes;
    return attrs.STR + attrs.AGI + attrs.SPD + attrs.REF + attrs.END + attrs.VIT;
}

/**
 * Initialize socket handlers
 */
export function initializeSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
    io.on('connection', (socket: BattleSocket) => {
        console.log(`[Socket] Client connected: ${socket.id}`);

        // Handle authentication (simplified - just use a header/query)
        const playerId = socket.handshake.auth.playerId as string;
        if (!playerId) {
            socket.emit('error', { message: 'Not authenticated', code: 'AUTH_ERROR' });
            socket.disconnect();
            return;
        }

        socketToPlayer.set(socket.id, playerId);
        console.log(`[Socket] Player ${playerId} authenticated`);

        // Auto-rejoin active room if player has one
        const activeRoom = RoomManager.getPlayerActiveRoom(playerId);
        if (activeRoom) {
            console.log(`[Socket] Player ${playerId} has active room ${activeRoom.id}, rejoining...`);
            socket.join(activeRoom.id);

            // Update socket ID in room
            if (activeRoom.hostPlayerId === playerId) {
                RoomManager.updateSocketId(activeRoom.id, playerId, socket.id, true);
            } else if (activeRoom.guestPlayerId === playerId) {
                RoomManager.updateSocketId(activeRoom.id, playerId, socket.id, false);
            }

            console.log(`[Socket] Player ${playerId} rejoined room ${activeRoom.id} with socket ${socket.id}`);
        }

        // Room management
        socket.on('create_room', (data, callback) =>
            handleCreateRoom(io, socket, playerId, data, callback));

        socket.on('join_room', (data, callback) =>
            handleJoinRoom(io, socket, playerId, data, callback));

        socket.on('leave_room', (data, callback) =>
            handleLeaveRoom(io, socket, playerId, data, callback));

        socket.on('cancel_room', (data, callback) =>
            handleCancelRoom(io, socket, playerId, data, callback));

        // Stake confirmation
        socket.on('stake_confirmed', (data, callback) =>
            handleStakeConfirmed(io, socket, playerId, data, callback));

        // Battle actions
        socket.on('submit_action', (data, callback) =>
            handleSubmitAction(io, socket, playerId, data, callback));

        // Lobby
        socket.on('get_rooms', (callback) =>
            handleGetRooms(callback));

        // Room state (for reconnection/sync)
        socket.on('get_room_state', (data: { roomId: string }, callback) => {
            const room = RoomManager.getRoom(data.roomId);
            if (!room) {
                callback({ success: false, error: 'Room not found' });
                return;
            }
            callback({
                success: true,
                state: room.state,
                hasOpponent: !!room.guestPlayerId
            });
        });

        // Disconnect
        socket.on('disconnect', () =>
            handleDisconnect(io, socket, playerId));
    });
}

/**
 * Handle room creation
 */
function handleCreateRoom(
    io: Server,
    socket: BattleSocket,
    playerId: string,
    data: CreateRoomData,
    callback?: (response: any) => void
): void {
    try {
        const room = RoomManager.createRoom(playerId, socket.id, data);

        // Join socket room
        socket.join(room.id);

        // Broadcast to lobby
        io.emit('room_created', {
            id: room.id,
            hostPlayerId: room.hostPlayerId,
            hostCreatureName: 'Unknown', // TODO: Fetch from DB
            hostCreatureLevel: 1,
            hostCreatureType: 'UNKNOWN',
            stakeAmount: room.stakeAmount,
            stakeToken: room.stakeToken,
            createdAt: room.createdAt,
            onChainBattleId: room.onChainBattleId
        });

        callback?.({ success: true, room });
    } catch (error: any) {
        callback?.({ success: false, error: error.message });
    }
}

/**
 * Handle room join
 */
function handleJoinRoom(
    io: Server,
    socket: BattleSocket,
    playerId: string,
    data: JoinRoomData,
    callback?: (response: any) => void
): void {
    const result = RoomManager.joinRoom(playerId, socket.id, data);

    if (!result.success) {
        callback?.(result);
        return;
    }

    const room = result.room!;

    // Join socket room
    socket.join(room.id);

    // Notify host that opponent joined
    if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('opponent_joined', {
            roomId: room.id,
            opponentPlayerId: playerId,
            opponentCreatureName: 'Unknown', // TODO: Fetch from DB
            opponentCreatureType: 'UNKNOWN'
        });
    }

    // Notify guest that they joined successfully and room is ready
    socket.emit('joined_room', {
        roomId: room.id,
        hostPlayerId: room.hostPlayerId,
        hostCreatureName: 'Unknown', // TODO: Fetch from DB
        hostCreatureType: 'UNKNOWN'
    });

    // Remove from public lobby
    io.emit('room_cancelled', room.id);

    callback?.({ success: true, room });

    // Auto-start battle after 2 seconds (bypass stake for testing)
    setTimeout(() => {
        const updatedRoom = RoomManager.getRoom(room.id);
        if (updatedRoom && updatedRoom.state === 'READY') {
            console.log(`[Battle] Auto-starting battle in room ${room.id}`);
            startBattle(io, updatedRoom).catch((err) => {
                console.error(`[Battle] Error starting battle in room ${room.id}:`, err);
            });
        } else {
            console.log(`[Battle] Room ${room.id} not ready, state: ${updatedRoom?.state}`);
        }
    }, 2000);
}

/**
 * Handle room leave
 */
function handleLeaveRoom(
    io: Server,
    socket: BattleSocket,
    playerId: string,
    data: { roomId: string },
    callback?: (response: any) => void
): void {
    const room = RoomManager.getRoom(data.roomId);
    if (!room) {
        callback?.({ success: false, error: 'Room not found' });
        return;
    }

    const isHost = room.hostPlayerId === playerId;
    const result = RoomManager.leaveRoom(data.roomId, playerId);

    if (result.success) {
        socket.leave(data.roomId);

        if (isHost) {
            // Notify guest and broadcast cancellation
            io.to(data.roomId).emit('opponent_left', { roomId: data.roomId });
            io.emit('room_cancelled', data.roomId);
        } else {
            // Notify host
            io.to(data.roomId).emit('opponent_left', { roomId: data.roomId });

            // Room back to waiting - broadcast to lobby
            if (result.room) {
                io.emit('room_created', {
                    id: result.room.id,
                    hostPlayerId: result.room.hostPlayerId,
                    hostCreatureName: 'Unknown',
                    hostCreatureLevel: 1,
                    hostCreatureType: 'UNKNOWN',
                    stakeAmount: result.room.stakeAmount,
                    stakeToken: result.room.stakeToken,
                    createdAt: result.room.createdAt
                });
            }
        }
    }

    callback?.(result);
}

/**
 * Handle room cancellation
 */
function handleCancelRoom(
    io: Server,
    socket: BattleSocket,
    playerId: string,
    data: { roomId: string },
    callback?: (response: any) => void
): void {
    const result = RoomManager.cancelRoom(data.roomId, playerId);

    if (result.success) {
        io.to(data.roomId).emit('opponent_left', { roomId: data.roomId });
        io.emit('room_cancelled', data.roomId);
    }

    callback?.(result);
}

/**
 * Handle stake confirmation
 */
function handleStakeConfirmed(
    io: Server,
    socket: BattleSocket,
    playerId: string,
    data: StakeConfirmedData,
    callback?: (response: any) => void
): void {
    // TODO: Verify transaction on-chain
    // For now, just mark as deposited

    const result = RoomManager.markStakeDeposited(data.roomId, playerId);

    if (!result.success) {
        callback?.(result);
        return;
    }

    const room = RoomManager.getRoom(data.roomId)!;

    // Notify both players of stake status
    io.to(data.roomId).emit('stake_status', {
        roomId: data.roomId,
        hostDeposited: room.hostStakeDeposited,
        guestDeposited: room.guestStakeDeposited
    });

    // If both deposited, start battle
    if (result.bothDeposited) {
        startBattle(io, room);
    }

    callback?.({ success: true });
}

/**
 * Start battle
 */
async function startBattle(io: Server, room: Room): Promise<void> {
    console.log(`[Battle] Starting battle in room ${room.id}`);
    console.log(`[Battle] Host creature: ${room.hostCreatureId}, Guest creature: ${room.guestCreatureId}`);

    // Fetch creatures from contract
    console.log(`[Battle] Fetching host creature...`);
    const creatureA = await creatureFetcher.fetchCreature(room.hostCreatureId, room.hostPlayerId);
    console.log(`[Battle] Host creature fetched:`, creatureA ? 'OK' : 'FAILED');

    console.log(`[Battle] Fetching guest creature...`);
    const creatureB = await creatureFetcher.fetchCreature(room.guestCreatureId!, room.guestPlayerId!);
    console.log(`[Battle] Guest creature fetched:`, creatureB ? 'OK' : 'FAILED');

    // If creature fetch fails, abort battle
    if (!creatureA || !creatureB) {
        const missingId = !creatureA ? room.hostCreatureId : room.guestCreatureId;
        console.error(`[Battle] Failed to fetch creature ${missingId}, aborting battle`);

        // Notify both players
        if (room.hostSocketId) {
            io.to(room.hostSocketId).emit('battle_error', { error: `Creature #${missingId} not found on-chain` });
        }
        if (room.guestSocketId) {
            io.to(room.guestSocketId).emit('battle_error', { error: `Creature #${missingId} not found on-chain` });
        }
        return;
    }

    console.log(`[Battle] Both creatures fetched successfully, proceeding...`);

    // Generate battle seed
    const seed = `battle_${room.id}_${Date.now()}`;

    // Determine who goes first based on total stats (lower = weaker = goes first)
    const totalStatsA = calculateTotalStats(creatureA);
    const totalStatsB = calculateTotalStats(creatureB);

    // Lower stats attacks first (if equal, host goes first)
    const firstPlayerId = totalStatsA <= totalStatsB ? room.hostPlayerId : room.guestPlayerId!;

    console.log(`[Battle] Total stats - Host: ${totalStatsA}, Guest: ${totalStatsB}`);
    console.log(`[Battle] First turn: ${firstPlayerId}`);

    // Initialize battle
    const battleState = initializeBattle(
        room.id,
        seed,
        room.hostPlayerId,
        room.guestPlayerId!,
        creatureA,
        creatureB
    );

    // Set current turn player
    battleState.currentTurnPlayer = firstPlayerId;

    RoomManager.setBattleState(room.id, battleState);

    // Send battle start to both players
    const hostSocket = room.hostSocketId;
    const guestSocket = room.guestSocketId;
    const isHostFirst = firstPlayerId === room.hostPlayerId;

    if (hostSocket) {
        io.to(hostSocket).emit('battle_start', {
            roomId: room.id,
            yourCreature: creatureA,
            opponentCreature: creatureB,
            yourTurn: isHostFirst,
            turnTimeoutMs: TURN_TIMEOUT_MS
        });
    }

    if (guestSocket) {
        io.to(guestSocket).emit('battle_start', {
            roomId: room.id,
            yourCreature: creatureB,
            opponentCreature: creatureA,
            yourTurn: !isHostFirst,
            turnTimeoutMs: TURN_TIMEOUT_MS
        });
    }

    // Send your_turn to first player only
    sendYourTurn(io, room, battleState);

    // Start turn timeout
    startTurnTimeout(io, room);
}

/**
 * Send your_turn to the current turn player only
 */
function sendYourTurn(io: Server, room: Room, battleState: BattleState): void {
    const currentPlayerId = battleState.currentTurnPlayer;
    const isHost = currentPlayerId === room.hostPlayerId;

    const creature = isHost ? battleState.creatureA : battleState.creatureB;
    const socketId = isHost ? room.hostSocketId : room.guestSocketId;

    if (!socketId) return;

    // Map all moves with cooldown status
    let availableMoves = creature.moves.map(m => ({
        moveId: m.moveId,
        name: m.name,
        power: m.power,
        category: m.category,
        accuracy: m.accuracy,
        type: m.type,
        onCooldown: (creature.cooldowns[m.moveId] ?? 0) > 0,
        cooldownRemaining: creature.cooldowns[m.moveId] ?? 0
    }));

    // IMPORTANT: Ensure at least one move is available!
    // If all moves are on cooldown, make the one with lowest remaining cooldown available
    const allOnCooldown = availableMoves.every(m => m.onCooldown);
    if (allOnCooldown && availableMoves.length > 0) {
        // Sort by cooldown remaining and make the lowest one available
        availableMoves.sort((a, b) => a.cooldownRemaining - b.cooldownRemaining);
        availableMoves[0].onCooldown = false; // Force first move to be available
        console.log(`[Battle] All moves on cooldown! Forcing ${availableMoves[0].name} to be available`);
    }

    io.to(socketId).emit('your_turn', {
        roomId: room.id,
        turnNumber: battleState.turnNumber,
        timeRemainingMs: TURN_TIMEOUT_MS,
        availableMoves
    });

    console.log(`[Battle] Sent your_turn to player ${currentPlayerId}`);
}

/**
 * Send waiting for action to both players (legacy, kept for compatibility)
 */
function sendWaitingForAction(io: Server, room: Room, battleState: BattleState): void {
    const hostMoves = battleState.creatureA.moves.map(m => ({
        moveId: m.moveId,
        name: m.name,
        onCooldown: (battleState.creatureA.cooldowns[m.moveId] ?? 0) > 0
    }));

    const guestMoves = battleState.creatureB.moves.map(m => ({
        moveId: m.moveId,
        name: m.name,
        onCooldown: (battleState.creatureB.cooldowns[m.moveId] ?? 0) > 0
    }));

    if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('waiting_for_action', {
            roomId: room.id,
            turnNumber: battleState.turnNumber,
            timeRemainingMs: TURN_TIMEOUT_MS,
            availableMoves: hostMoves
        });
    }

    if (room.guestSocketId) {
        io.to(room.guestSocketId).emit('waiting_for_action', {
            roomId: room.id,
            turnNumber: battleState.turnNumber,
            timeRemainingMs: TURN_TIMEOUT_MS,
            availableMoves: guestMoves
        });
    }
}

/**
 * Handle action submission (Turn-based: execute immediately)
 */
function handleSubmitAction(
    io: Server,
    socket: BattleSocket,
    playerId: string,
    data: SubmitActionData,
    callback?: (response: any) => void
): void {
    const room = RoomManager.getRoom(data.roomId);

    if (!room || room.state !== 'BATTLE') {
        callback?.({ success: false, error: 'No active battle' });
        return;
    }

    const battleState = room.battleState as BattleState;

    // Check if it's this player's turn
    if (battleState.currentTurnPlayer !== playerId) {
        callback?.({ success: false, error: 'Not your turn' });
        return;
    }

    // Clear turn timeout
    const timeout = turnTimeouts.get(room.id);
    if (timeout) {
        clearTimeout(timeout);
        turnTimeouts.delete(room.id);
    }

    const isHost = room.hostPlayerId === playerId;
    const creature = isHost ? battleState.creatureA : battleState.creatureB;
    const target = isHost ? battleState.creatureB : battleState.creatureA;

    // Find the move
    const move = creature.moves.find(m => m.moveId === data.moveId);
    if (!move) {
        callback?.({ success: false, error: 'Invalid move' });
        return;
    }

    callback?.({ success: true });

    console.log(`[Battle] Player ${playerId} uses ${move.name}`);

    // Use imported RNG and attack functions
    const rng = new DeterministicRNG(battleState.seed + battleState.turnNumber);

    // Execute the action
    let actionResult;
    if (move.category === 'STATUS') {
        // Status moves - simplified for now
        actionResult = {
            attackerId: creature.id,
            targetId: target.id,
            moveId: move.moveId,
            moveName: move.name,
            hit: true,
            critical: false,
            damage: 0,
            attackerHpAfter: creature.currentHp,
            targetHpAfter: target.currentHp
        };
    } else {
        // Attack move
        actionResult = executeAttack(rng, creature, target, move);
    }

    // Increment turn number (each action is a half-turn)
    battleState.turnNumber += 0.5;

    // Create turn update data
    const actionData = {
        attackerName: creature.name,
        moveName: move.name,
        targetName: target.name,
        damage: actionResult.damage,
        hit: actionResult.hit,
        critical: actionResult.critical,
        statusApplied: actionResult.statusApplied
    };

    const hostUpdate: TurnUpdateData = {
        roomId: room.id,
        turnNumber: Math.floor(battleState.turnNumber),
        actions: [actionData],
        yourHp: battleState.creatureA.currentHp,
        yourMaxHp: battleState.creatureA.maxHp,
        opponentHp: battleState.creatureB.currentHp,
        opponentMaxHp: battleState.creatureB.maxHp,
        knockouts: target.currentHp <= 0 ? [target.id] : []
    };

    const guestUpdate: TurnUpdateData = {
        ...hostUpdate,
        yourHp: battleState.creatureB.currentHp,
        yourMaxHp: battleState.creatureB.maxHp,
        opponentHp: battleState.creatureA.currentHp,
        opponentMaxHp: battleState.creatureA.maxHp
    };

    // Send turn update to both players
    if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('turn_update', hostUpdate);
    }
    if (room.guestSocketId) {
        io.to(room.guestSocketId).emit('turn_update', guestUpdate);
    }

    // Check if battle is over
    if (target.currentHp <= 0) {
        battleState.winner = playerId;
        endBattle(io, room, battleState);
        return;
    }

    // Switch turn to other player
    battleState.currentTurnPlayer = isHost ? room.guestPlayerId! : room.hostPlayerId;
    console.log(`[Battle] Turn switched to ${battleState.currentTurnPlayer}`);

    // Send your_turn to next player
    sendYourTurn(io, room, battleState);

    // Start new turn timeout
    startTurnTimeout(io, room);
}

/**
 * Execute battle turn
 */
function executeBattleTurn(io: Server, room: Room): void {
    // Clear timeout
    const timeout = turnTimeouts.get(room.id);
    if (timeout) {
        clearTimeout(timeout);
        turnTimeouts.delete(room.id);
    }

    const battleState = room.battleState as BattleState;
    const actionHost = room.pendingActionHost as BattleAction;
    const actionGuest = room.pendingActionGuest as BattleAction;

    // Execute turn
    const turnResult = executeTurn(battleState, actionHost, actionGuest);

    // Clear pending actions
    RoomManager.clearPendingActions(room.id);

    // Send turn update to both players
    const hostUpdate: TurnUpdateData = {
        roomId: room.id,
        turnNumber: turnResult.turnNumber,
        actions: turnResult.actions.map(a => ({
            attackerName: a.attackerId === battleState.creatureA.id
                ? battleState.creatureA.name
                : battleState.creatureB.name,
            moveName: a.moveName,
            targetName: a.targetId === battleState.creatureA.id
                ? battleState.creatureA.name
                : battleState.creatureB.name,
            damage: a.damage,
            hit: a.hit,
            critical: a.critical,
            statusApplied: a.statusApplied
        })),
        yourHp: battleState.creatureA.currentHp,
        yourMaxHp: battleState.creatureA.maxHp,
        opponentHp: battleState.creatureB.currentHp,
        opponentMaxHp: battleState.creatureB.maxHp,
        knockouts: turnResult.knockouts
    };

    const guestUpdate: TurnUpdateData = {
        ...hostUpdate,
        yourHp: battleState.creatureB.currentHp,
        yourMaxHp: battleState.creatureB.maxHp,
        opponentHp: battleState.creatureA.currentHp,
        opponentMaxHp: battleState.creatureA.maxHp
    };

    if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('turn_update', hostUpdate);
    }
    if (room.guestSocketId) {
        io.to(room.guestSocketId).emit('turn_update', guestUpdate);
    }

    // Check if battle is over
    if (isBattleOver(battleState)) {
        endBattle(io, room, battleState);
    } else {
        // Start next turn
        sendWaitingForAction(io, room, battleState);
        startTurnTimeout(io, room);
    }
}

/**
 * Start turn timeout
 */
function startTurnTimeout(io: Server, room: Room): void {
    // Clear any existing timeout
    const existing = turnTimeouts.get(room.id);
    if (existing) {
        clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
        handleTurnTimeout(io, room);
    }, TURN_TIMEOUT_MS);

    turnTimeouts.set(room.id, timeout);
}

/**
 * Handle turn timeout
 */
function handleTurnTimeout(io: Server, room: Room): void {
    const battleState = room.battleState as BattleState;
    const currentPlayerId = battleState.currentTurnPlayer;

    console.log(`[Battle] Turn timeout in room ${room.id}. Player ${currentPlayerId} loses for inactivity.`);

    // The player who didn't act in time loses
    const winner = currentPlayerId === room.hostPlayerId ? room.guestPlayerId! : room.hostPlayerId;
    battleState.winner = winner;
    battleState.forfeit = currentPlayerId;

    endBattle(io, room, battleState);
}

/**
 * End battle
 */
function endBattle(io: Server, room: Room, battleState: BattleState): void {
    console.log(`[Battle] Battle ended in room ${room.id}. Winner: ${battleState.winner}`);

    const winner = battleState.winner;

    // Reward is now handled on-chain via BattleGate.rewardWinner()
    // For now, we just emit the battle_end event - the reward amount is configured in GameConfig
    const reward = '8000000000000000000'; // 8 DGNE (placeholder - actual reward handled on-chain)

    // Send end to host
    if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('battle_end', {
            roomId: room.id,
            winner: winner || 'draw',
            youWon: winner === room.hostPlayerId,
            reward: winner === room.hostPlayerId ? reward.toString() : '0',
            totalTurns: battleState.turnNumber
        });
    }

    // Send end to guest
    if (room.guestSocketId) {
        io.to(room.guestSocketId).emit('battle_end', {
            roomId: room.id,
            winner: winner || 'draw',
            youWon: winner === room.guestPlayerId,
            reward: winner === room.guestPlayerId ? reward.toString() : '0',
            totalTurns: battleState.turnNumber
        });
    }

    // Trigger on-chain operations SEQUENTIALLY to avoid nonce conflicts with hardhat automining
    // Using async IIFE to not block the main flow
    (async () => {
        // STEP 1: Resolve battle on-chain first (most important)
        console.log(`[Battle] Checking on-chain resolution: winner=${winner}, onChainBattleId=${room.onChainBattleId}`);
        if (winner && room.onChainBattleId) {
            try {
                const result = await battleGateV2Service.resolveBattle(room.onChainBattleId, winner);
                if (result.success) {
                    console.log(`[Battle] Battle ${room.onChainBattleId} resolved on-chain: ${result.txHash}`);
                } else {
                    console.error(`[Battle] Failed to resolve battle on-chain: ${result.error}`);
                }
            } catch (err: any) {
                console.error(`[Battle] On-chain resolve error:`, err.message);
            }
        } else if (winner) {
            // Legacy path: use old reward system if no on-chain battle ID
            const winnerNonce = winner === room.hostPlayerId
                ? room.hostBattleNonce
                : room.guestBattleNonce;

            if (winnerNonce) {
                try {
                    const result = await rewardBattleWinner(winner, winnerNonce);
                    if (result.success) {
                        console.log(`[Battle] Winner ${winner} rewarded ${result.amount} DGNE on-chain: ${result.txHash}`);
                    } else {
                        console.error(`[Battle] Failed to reward winner: ${result.error}`);
                    }
                } catch (err: any) {
                    console.error(`[Battle] Reward error:`, err.message);
                }
            } else {
                console.warn(`[Battle] No battle nonce or on-chain ID found for winner ${winner}`);
            }
        }

        // STEP 2: Update HP on-chain (sequential, one at a time)
        if (winner && room.hostCreatureId && room.guestCreatureId) {
            const winnerCreatureId = winner === room.hostPlayerId ? room.hostCreatureId : room.guestCreatureId;
            const loserCreatureId = winner === room.hostPlayerId ? room.guestCreatureId : room.hostCreatureId;

            const winnerStats = winner === room.hostPlayerId ? battleState.creatureA : battleState.creatureB;
            const winnerHpPercent = Math.round((winnerStats.currentHp / winnerStats.maxHp) * 100);
            const loserStats = winner === room.hostPlayerId ? battleState.creatureB : battleState.creatureA;
            const loserHpPercent = Math.max(0, Math.round((loserStats.currentHp / loserStats.maxHp) * 100));

            console.log(`[HP] Saving on-chain HP: winner #${winnerCreatureId}=${winnerHpPercent}%, loser #${loserCreatureId}=${loserHpPercent}%`);

            try {
                // Update winner HP first
                await creatureFetcher.setHP(winnerCreatureId, winnerHpPercent);
                console.log(`[HP] Winner creature #${winnerCreatureId} HP updated`);

                // Then loser HP
                await creatureFetcher.setHP(loserCreatureId, loserHpPercent);
                console.log(`[HP] Loser creature #${loserCreatureId} HP updated`);
            } catch (err: any) {
                console.error(`[HP] Failed to update HP: ${err.message}`);
            }

            // STEP 3: Award XP (after HP updates)
            const isPerfectWin = winnerStats.currentHp === winnerStats.maxHp;
            try {
                await xpService.awardBattleXP(winnerCreatureId, loserCreatureId, isPerfectWin);
                console.log(`[XP] Battle XP awarded successfully`);
            } catch (err: any) {
                console.error(`[XP] Failed to award XP: ${err.message}`);
            }
        }
    })();

    // Complete room (don't wait for on-chain ops)
    RoomManager.completeRoom(room.id, winner || 'draw');
}

/**
 * Handle get rooms (lobby)
 */
function handleGetRooms(callback: (rooms: any[]) => void): void {
    const waitingRooms = RoomManager.getWaitingRooms();

    const publicRooms = waitingRooms.map(room => ({
        id: room.id,
        hostPlayerId: room.hostPlayerId,
        hostCreatureName: 'Unknown', // TODO: Fetch from DB
        hostCreatureLevel: 1,
        hostCreatureType: 'UNKNOWN',
        stakeAmount: room.stakeAmount,
        stakeToken: room.stakeToken,
        createdAt: room.createdAt,
        onChainBattleId: room.onChainBattleId
    }));

    callback(publicRooms);
}

/**
 * Handle disconnect
 */
function handleDisconnect(io: Server, socket: BattleSocket, playerId: string): void {
    console.log(`[Socket] Player ${playerId} disconnected`);

    socketToPlayer.delete(socket.id);

    // Check if player was in a room
    const room = RoomManager.getRoomByPlayer(playerId);
    if (room) {
        if (room.state === 'BATTLE') {
            // Forfeit battle
            const battleState = room.battleState as BattleState;
            forfeitBattle(battleState, playerId);
            endBattle(io, room, battleState);
        } else {
            // Leave room
            RoomManager.leaveRoom(room.id, playerId);
            io.to(room.id).emit('opponent_left', { roomId: room.id });

            if (room.hostPlayerId === playerId) {
                io.emit('room_cancelled', room.id);
            }
        }
    }
}

/**
 * Create mock creature for testing
 * TODO: Replace with actual DB fetch
 */
function createMockCreature(
    id: string,
    ownerId: string,
    elementType: 'ELECTRIC' | 'ICE'
): BattleCreature {
    const moves = elementType === 'ELECTRIC'
        ? [
            { moveId: 'spark', name: 'Spark', type: 'ELECTRIC' as const, category: 'SPECIAL' as const, power: 55, accuracy: 100, cooldownMax: 0, priority: 0, statusEffect: 'PARALYZE' as const, statusChance: 0.10 },
            { moveId: 'thunderbolt', name: 'Thunderbolt', type: 'ELECTRIC' as const, category: 'SPECIAL' as const, power: 95, accuracy: 80, cooldownMax: 1, priority: 0, statusEffect: 'PARALYZE' as const, statusChance: 0.20 },
            { moveId: 'volt_switch', name: 'Volt Switch', type: 'ELECTRIC' as const, category: 'PHYSICAL' as const, power: 70, accuracy: 90, cooldownMax: 1, priority: 2, statusChance: 0 },
            { moveId: 'thunder', name: 'Thunder', type: 'ELECTRIC' as const, category: 'SPECIAL' as const, power: 130, accuracy: 60, cooldownMax: 3, priority: 0, statusEffect: 'PARALYZE' as const, statusChance: 0.40 }
        ]
        : [
            { moveId: 'ice_shard', name: 'Ice Shard', type: 'ICE' as const, category: 'PHYSICAL' as const, power: 50, accuracy: 100, cooldownMax: 0, priority: 1, statusChance: 0 },
            { moveId: 'blizzard', name: 'Blizzard', type: 'ICE' as const, category: 'SPECIAL' as const, power: 115, accuracy: 65, cooldownMax: 3, priority: 0, statusEffect: 'FREEZE' as const, statusChance: 0.25 },
            { moveId: 'ice_fang', name: 'Ice Fang', type: 'ICE' as const, category: 'PHYSICAL' as const, power: 65, accuracy: 95, cooldownMax: 0, priority: 0, statusEffect: 'FREEZE' as const, statusChance: 0.10 },
            { moveId: 'absolute_zero', name: 'Absolute Zero', type: 'ICE' as const, category: 'SPECIAL' as const, power: 90, accuracy: 75, cooldownMax: 2, priority: 0, statusEffect: 'FREEZE' as const, statusChance: 0.40 }
        ];

    return {
        id,
        name: elementType === 'ELECTRIC' ? 'Thunder Serpent' : 'Frost Wyrm',
        ownerId,
        elementType,
        talent: 70,
        temperament: 'NEUTRAL',
        attributes: {
            STR: 60,
            AGI: 75,
            SPD: elementType === 'ELECTRIC' ? 85 : 65,
            REF: 55,
            END: 50,
            VIT: 45,
            INT: 40,
            PRC: 60,
            RGN: 35
        },
        moves,
        moveMastery: Object.fromEntries(moves.map(m => [m.moveId, 1.0])),
        aptitudeVsType: {
            FIRE: 1.0, WATER: 1.0, GRASS: 1.0, ELECTRIC: 1.0,
            ICE: 1.0, EARTH: 1.0, DARK: 1.0, LIGHT: 1.0
        },
        currentHp: 0,
        maxHp: 0,
        cooldowns: {},
        statusEffects: []
    };
}
