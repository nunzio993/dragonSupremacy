/**
 * Matchmaking Types
 */

import { BattleCreature, BattleState, BattleAction } from '../battle/types.js';

// Room states
export type RoomState =
    | 'WAITING'      // Waiting for opponent
    | 'READY'        // Both players, waiting for stakes
    | 'STAKES_PENDING' // Waiting for on-chain deposits
    | 'BATTLE'       // Battle in progress
    | 'COMPLETED'    // Battle ended
    | 'CANCELLED';   // Room cancelled

// Room info
export interface Room {
    id: string;
    createdAt: Date;
    state: RoomState;

    // Players
    hostPlayerId: string;
    hostCreatureId: string;
    hostSocketId?: string;

    guestPlayerId?: string;
    guestCreatureId?: string;
    guestSocketId?: string;

    // Stake
    stakeAmount: string;  // In wei
    stakeToken: 'ETH' | 'USDC';
    hostStakeDeposited: boolean;
    guestStakeDeposited: boolean;

    // Battle state (once started)
    battleState?: BattleState;

    // Pending actions (for current turn)
    pendingActionHost?: BattleAction;
    pendingActionGuest?: BattleAction;

    // Timeouts
    turnStartedAt?: Date;
    lastActivityAt: Date;

    // Battle nonces for on-chain rewards (from BattleGate.payEntryFee)
    hostBattleNonce?: string;
    guestBattleNonce?: string;

    // BattleGateV2 on-chain battle ID (bytes32)
    onChainBattleId?: string;
}

// Public room info (for lobby listing)
export interface PublicRoomInfo {
    id: string;
    hostPlayerId: string;
    hostCreatureName: string;
    hostCreatureLevel: number;
    hostCreatureType: string;
    stakeAmount: string;
    stakeToken: 'ETH' | 'USDC';
    createdAt: Date;
    onChainBattleId?: string; // BattleGateV2 battle ID
}

// Socket events - Client to Server
export interface ClientToServerEvents {
    // Room management
    'create_room': (data: CreateRoomData, callback: (response: RoomResponse) => void) => void;
    'join_room': (data: JoinRoomData, callback: (response: RoomResponse) => void) => void;
    'leave_room': (data: { roomId: string }, callback: (response: SimpleResponse) => void) => void;
    'cancel_room': (data: { roomId: string }, callback: (response: SimpleResponse) => void) => void;

    // Stake confirmation
    'stake_confirmed': (data: StakeConfirmedData, callback: (response: SimpleResponse) => void) => void;

    // Battle actions
    'submit_action': (data: SubmitActionData, callback: (response: SimpleResponse) => void) => void;

    // Lobby
    'get_rooms': (callback: (rooms: PublicRoomInfo[]) => void) => void;

    // Room state (for reconnection/sync)
    'get_room_state': (data: { roomId: string }, callback: (response: { success: boolean; state?: RoomState; hasOpponent?: boolean; error?: string }) => void) => void;
}

// Socket events - Server to Client
export interface ServerToClientEvents {
    // Room updates
    'room_created': (room: PublicRoomInfo) => void;
    'room_cancelled': (roomId: string) => void;
    'opponent_joined': (data: OpponentJoinedData) => void;
    'opponent_left': (data: { roomId: string }) => void;
    'joined_room': (data: JoinedRoomData) => void;

    // Stake updates
    'stake_status': (data: StakeStatusData) => void;

    // Battle updates
    'battle_start': (data: BattleStartData) => void;
    'turn_update': (data: TurnUpdateData) => void;
    'waiting_for_action': (data: WaitingForActionData) => void;
    'your_turn': (data: YourTurnData) => void;
    'battle_end': (data: BattleEndData) => void;

    // Errors
    'error': (data: { message: string; code: string }) => void;
}

// Data types for events
export interface CreateRoomData {
    creatureId: string;
    stakeAmount?: string;
    stakeToken?: 'ETH' | 'USDC';
    battleNonce?: string;  // From BattleGate.payEntryFee transaction (legacy)
    onChainBattleId?: string; // BattleGateV2 battle ID (bytes32)
}

export interface JoinRoomData {
    roomId: string;
    creatureId: string;
    battleNonce: string;  // From BattleGate.payEntryFee transaction
    onChainBattleId?: string; // BattleGateV2 battle ID (bytes32)
}

export interface StakeConfirmedData {
    roomId: string;
    txHash: string;
}

export interface SubmitActionData {
    roomId: string;
    moveId: string;
}

export interface OpponentJoinedData {
    roomId: string;
    opponentPlayerId: string;
    opponentCreatureName: string;
    opponentCreatureType: string;
}

export interface JoinedRoomData {
    roomId: string;
    hostPlayerId: string;
    hostCreatureName: string;
    hostCreatureType: string;
}

export interface StakeStatusData {
    roomId: string;
    hostDeposited: boolean;
    guestDeposited: boolean;
}

export interface BattleStartData {
    roomId: string;
    yourCreature: BattleCreature;
    opponentCreature: BattleCreature;
    yourTurn: boolean;
    turnTimeoutMs: number;
}

export interface WaitingForActionData {
    roomId: string;
    turnNumber: number;
    timeRemainingMs: number;
    availableMoves: { moveId: string; name: string; onCooldown: boolean }[];
}

export interface YourTurnData {
    roomId: string;
    turnNumber: number;
    timeRemainingMs: number;
    availableMoves: { moveId: string; name: string; onCooldown: boolean }[];
}

export interface TurnUpdateData {
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

export interface BattleEndData {
    roomId: string;
    winner: string;
    youWon: boolean;
    reward: string;  // Amount won (after fee)
    totalTurns: number;
}

export interface RoomResponse {
    success: boolean;
    room?: Room;
    error?: string;
}

export interface SimpleResponse {
    success: boolean;
    error?: string;
}
