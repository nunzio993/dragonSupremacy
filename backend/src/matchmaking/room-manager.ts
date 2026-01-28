/**
 * Room Manager
 * Handles room lifecycle: create, join, leave, cancel
 */

import { v4 as uuidv4 } from 'uuid';
import {
    Room,
    RoomState,
    PublicRoomInfo,
    CreateRoomData,
    JoinRoomData
} from './types.js';

// In-memory room storage (replace with Redis in production)
const rooms = new Map<string, Room>();

// Player to room mapping
const playerRooms = new Map<string, string>();

/**
 * Create a new room
 */
export function createRoom(
    playerId: string,
    socketId: string,
    data: CreateRoomData
): Room {
    // Check if player already in a room
    const existingRoomId = playerRooms.get(playerId);
    if (existingRoomId) {
        const existing = rooms.get(existingRoomId);
        if (existing && existing.state === 'WAITING') {
            // Cancel existing room
            cancelRoom(existingRoomId, playerId);
        }
    }

    const room: Room = {
        id: uuidv4(),
        createdAt: new Date(),
        state: 'WAITING',

        hostPlayerId: playerId,
        hostCreatureId: data.creatureId,
        hostSocketId: socketId,

        stakeAmount: data.stakeAmount || '0',
        stakeToken: data.stakeToken || 'ETH',
        hostStakeDeposited: false,
        guestStakeDeposited: false,

        // Save host's battle nonce for on-chain reward
        hostBattleNonce: data.battleNonce,

        // BattleGateV2 on-chain battle ID
        onChainBattleId: data.onChainBattleId,

        lastActivityAt: new Date()
    };

    rooms.set(room.id, room);
    playerRooms.set(playerId, room.id);

    console.log(`[RoomManager] Room ${room.id} created by ${playerId}, onChainBattleId: ${room.onChainBattleId}`);

    return room;
}

/**
 * Join an existing room
 */
export function joinRoom(
    playerId: string,
    socketId: string,
    data: JoinRoomData
): { success: boolean; room?: Room; error?: string } {
    const room = rooms.get(data.roomId);

    if (!room) {
        return { success: false, error: 'Room not found' };
    }

    if (room.state !== 'WAITING') {
        return { success: false, error: 'Room is not available' };
    }

    if (room.hostPlayerId === playerId) {
        return { success: false, error: 'Cannot join your own room' };
    }

    // Leave any existing room
    const existingRoomId = playerRooms.get(playerId);
    if (existingRoomId && existingRoomId !== data.roomId) {
        leaveRoom(existingRoomId, playerId);
    }

    // Join room
    room.guestPlayerId = playerId;
    room.guestCreatureId = data.creatureId;
    room.guestSocketId = socketId;
    room.guestBattleNonce = data.battleNonce;  // Save guest's battle nonce
    room.state = 'READY';
    room.lastActivityAt = new Date();

    playerRooms.set(playerId, room.id);

    console.log(`[RoomManager] Player ${playerId} joined room ${room.id}`);

    return { success: true, room };
}

/**
 * Leave a room
 */
export function leaveRoom(
    roomId: string,
    playerId: string
): { success: boolean; room?: Room; error?: string } {
    const room = rooms.get(roomId);

    if (!room) {
        return { success: false, error: 'Room not found' };
    }

    const isHost = room.hostPlayerId === playerId;
    const isGuest = room.guestPlayerId === playerId;

    if (!isHost && !isGuest) {
        return { success: false, error: 'Not in this room' };
    }

    playerRooms.delete(playerId);

    if (isHost) {
        // Host leaves = cancel room
        room.state = 'CANCELLED';
        rooms.delete(roomId);
        console.log(`[RoomManager] Room ${roomId} cancelled (host left)`);
    } else if (isGuest) {
        // Guest leaves = room goes back to waiting
        room.guestPlayerId = undefined;
        room.guestCreatureId = undefined;
        room.guestSocketId = undefined;
        room.state = 'WAITING';
        room.lastActivityAt = new Date();
        console.log(`[RoomManager] Guest left room ${roomId}`);
    }

    return { success: true, room };
}

/**
 * Cancel a room (only host can)
 */
export function cancelRoom(
    roomId: string,
    playerId: string
): { success: boolean; error?: string } {
    const room = rooms.get(roomId);

    if (!room) {
        return { success: false, error: 'Room not found' };
    }

    if (room.hostPlayerId !== playerId) {
        return { success: false, error: 'Only host can cancel' };
    }

    if (room.state === 'BATTLE') {
        return { success: false, error: 'Cannot cancel during battle' };
    }

    // Remove player mappings
    playerRooms.delete(room.hostPlayerId);
    if (room.guestPlayerId) {
        playerRooms.delete(room.guestPlayerId);
    }

    room.state = 'CANCELLED';
    rooms.delete(roomId);

    console.log(`[RoomManager] Room ${roomId} cancelled by host`);

    return { success: true };
}

/**
 * Get room by ID
 */
export function getRoom(roomId: string): Room | undefined {
    return rooms.get(roomId);
}

/**
 * Get room by player ID
 */
export function getRoomByPlayer(playerId: string): Room | undefined {
    const roomId = playerRooms.get(playerId);
    return roomId ? rooms.get(roomId) : undefined;
}

/**
 * Get player's active room (READY or BATTLE state)
 */
export function getPlayerActiveRoom(playerId: string): Room | undefined {
    const roomId = playerRooms.get(playerId);
    if (!roomId) return undefined;

    const room = rooms.get(roomId);
    if (!room) return undefined;

    // Only return if room is in active state
    if (room.state === 'READY' || room.state === 'BATTLE') {
        return room;
    }
    return undefined;
}

/**
 * Update socket ID for a player in a room (used for reconnection)
 */
export function updateSocketId(roomId: string, playerId: string, newSocketId: string, isHost: boolean): void {
    const room = rooms.get(roomId);
    if (!room) return;

    if (isHost && room.hostPlayerId === playerId) {
        room.hostSocketId = newSocketId;
        console.log(`[RoomManager] Updated host socket to ${newSocketId} in room ${roomId}`);
    } else if (!isHost && room.guestPlayerId === playerId) {
        room.guestSocketId = newSocketId;
        console.log(`[RoomManager] Updated guest socket to ${newSocketId} in room ${roomId}`);
    }
}

/**
 * Get all waiting rooms (for lobby)
 */
export function getWaitingRooms(): Room[] {
    return Array.from(rooms.values())
        .filter(room => room.state === 'WAITING');
}

/**
 * Convert room to public info (for lobby listing)
 */
export function toPublicRoomInfo(room: Room, creatureName: string, creatureLevel: number, creatureType: string): PublicRoomInfo {
    return {
        id: room.id,
        hostPlayerId: room.hostPlayerId,
        hostCreatureName: creatureName,
        hostCreatureLevel: creatureLevel,
        hostCreatureType: creatureType,
        stakeAmount: room.stakeAmount,
        stakeToken: room.stakeToken,
        createdAt: room.createdAt,
        onChainBattleId: room.onChainBattleId
    };
}

/**
 * Update room state
 */
export function updateRoomState(roomId: string, state: RoomState): void {
    const room = rooms.get(roomId);
    if (room) {
        room.state = state;
        room.lastActivityAt = new Date();
    }
}

/**
 * Mark stake as deposited
 */
export function markStakeDeposited(
    roomId: string,
    playerId: string
): { success: boolean; bothDeposited: boolean; error?: string } {
    const room = rooms.get(roomId);

    if (!room) {
        return { success: false, bothDeposited: false, error: 'Room not found' };
    }

    if (room.hostPlayerId === playerId) {
        room.hostStakeDeposited = true;
    } else if (room.guestPlayerId === playerId) {
        room.guestStakeDeposited = true;
    } else {
        return { success: false, bothDeposited: false, error: 'Not in this room' };
    }

    const bothDeposited = room.hostStakeDeposited && room.guestStakeDeposited;

    if (bothDeposited) {
        room.state = 'BATTLE';
    }

    return { success: true, bothDeposited };
}

/**
 * Set battle state for room
 */
export function setBattleState(roomId: string, battleState: any): void {
    const room = rooms.get(roomId);
    if (room) {
        room.state = 'BATTLE';  // Important: update room state!
        room.battleState = battleState;
        room.turnStartedAt = new Date();
        console.log(`[RoomManager] Room ${roomId} state changed to BATTLE`);
    }
}

/**
 * Set pending action for a player
 */
export function setPendingAction(
    roomId: string,
    playerId: string,
    action: any
): { success: boolean; bothActed: boolean } {
    const room = rooms.get(roomId);

    if (!room) {
        return { success: false, bothActed: false };
    }

    if (room.hostPlayerId === playerId) {
        room.pendingActionHost = action;
    } else if (room.guestPlayerId === playerId) {
        room.pendingActionGuest = action;
    }

    const bothActed = !!room.pendingActionHost && !!room.pendingActionGuest;

    return { success: true, bothActed };
}

/**
 * Clear pending actions (after turn execution)
 */
export function clearPendingActions(roomId: string): void {
    const room = rooms.get(roomId);
    if (room) {
        room.pendingActionHost = undefined;
        room.pendingActionGuest = undefined;
        room.turnStartedAt = new Date();
    }
}

/**
 * Complete a room (after battle ends)
 */
export function completeRoom(roomId: string, winner: string): void {
    const room = rooms.get(roomId);
    if (room) {
        room.state = 'COMPLETED';
        room.lastActivityAt = new Date();

        // Clean up player mappings
        playerRooms.delete(room.hostPlayerId);
        if (room.guestPlayerId) {
            playerRooms.delete(room.guestPlayerId);
        }

        // Keep room for a while for reference, then delete
        setTimeout(() => {
            rooms.delete(roomId);
            console.log(`[RoomManager] Room ${roomId} cleaned up`);
        }, 60000); // 1 minute
    }
}

/**
 * Get stale rooms (for cleanup)
 */
export function getStaleRooms(maxAgeMs: number): Room[] {
    const now = new Date();
    return Array.from(rooms.values())
        .filter(room => {
            const age = now.getTime() - room.lastActivityAt.getTime();
            return age > maxAgeMs && room.state === 'WAITING';
        });
}

/**
 * Clean up stale rooms
 */
export function cleanupStaleRooms(): number {
    const staleRooms = getStaleRooms(5 * 60 * 1000); // 5 minutes

    for (const room of staleRooms) {
        playerRooms.delete(room.hostPlayerId);
        if (room.guestPlayerId) {
            playerRooms.delete(room.guestPlayerId);
        }
        rooms.delete(room.id);
    }

    if (staleRooms.length > 0) {
        console.log(`[RoomManager] Cleaned up ${staleRooms.length} stale rooms`);
    }

    return staleRooms.length;
}

// Periodic cleanup
setInterval(cleanupStaleRooms, 60000); // Every minute
