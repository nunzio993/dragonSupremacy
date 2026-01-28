/**
 * Socket.io Client for Matchmaking
 */

import { io, Socket } from 'socket.io-client';

// Server URL (use env var in production)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Socket instance (singleton)
let socket: Socket | null = null;

/**
 * Initialize socket connection with player auth
 */
export function initSocket(playerId: string): Socket {
    if (socket?.connected) {
        return socket;
    }

    socket = io(SOCKET_URL, {
        auth: {
            playerId,
        },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
        console.log('[Socket] Connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
    });

    socket.on('error', (data) => {
        console.error('[Socket] Error:', data);
    });

    return socket;
}

/**
 * Get current socket instance
 */
export function getSocket(): Socket | null {
    return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

/**
 * Check if socket is connected
 */
export function isConnected(): boolean {
    return socket?.connected ?? false;
}

// Event types for type safety
export interface RoomInfo {
    id: string;
    hostPlayerId: string;
    hostCreatureName: string;
    hostCreatureLevel: number;
    hostCreatureType: string;
    stakeAmount: string;
    stakeToken: 'ETH' | 'USDC';
    createdAt: Date;
    onChainBattleId?: string; // BattleGateV2 battle ID (bytes32)
}

export interface BattleCreature {
    id: string;
    name: string;
    elementType: string;
    currentHp: number;
    maxHp: number;
    attributes?: {
        STR: number;
        AGI: number;
        SPD: number;
        REF: number;
        END: number;
        VIT: number;
        INT: number;
        PRC: number;
        RGN: number;
    };
    moves: { moveId: string; name: string; onCooldown: boolean }[];
}

export interface TurnUpdate {
    roomId: string;
    turnNumber: number;
    actions: {
        attackerName: string;
        moveName: string;
        targetName: string;
        damage: number;
        hit: boolean;
        critical: boolean;
        statusApplied?: string;
    }[];
    yourHp: number;
    yourMaxHp: number;
    opponentHp: number;
    opponentMaxHp: number;
    knockouts: string[];
}

export interface BattleEnd {
    roomId: string;
    winner: string;
    youWon: boolean;
    reward: string;
    totalTurns: number;
}
