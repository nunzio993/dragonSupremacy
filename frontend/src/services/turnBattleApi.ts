/**
 * Turn Battle API Service
 *
 * Handles all turn-based battle API calls.
 */
import { BattleState, PlayerAction, BattleRewardPayload } from '@nft-autobattler/shared-types';

export interface StartBattleResponse {
    matchId: string;
    state: BattleState;
}

export interface ActionResponse {
    state: BattleState;
    rewards?: BattleRewardPayload;
}

export interface BattleStateResponse {
    matchId: string;
    state: BattleState;
    createdAt: string;
    updatedAt: string;
}

export interface ActiveBattle {
    matchId: string;
    turnNumber: number;
    createdAt: string;
    updatedAt: string;
}

class TurnBattleApi {
    /**
     * Start a new turn-based battle against AI.
     */
    async startBattle(
        creatureInstanceIds: string[],
        difficulty: 'easy' | 'medium' | 'hard' = 'easy'
    ): Promise<StartBattleResponse> {
        const response = await fetch('/api/v1/turn-battle/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.getToken()}`,
            },
            body: JSON.stringify({ creatureInstanceIds, difficulty }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to start battle');
        }

        return data.data;
    }

    /**
     * Send an action for the current turn.
     */
    async sendAction(matchId: string, action: PlayerAction): Promise<ActionResponse> {
        const response = await fetch('/api/v1/turn-battle/action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.getToken()}`,
            },
            body: JSON.stringify({ matchId, action }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to send action');
        }

        return data.data;
    }

    /**
     * Fetch the current state of a battle.
     */
    async fetchState(matchId: string): Promise<BattleStateResponse> {
        const response = await fetch(`/api/v1/turn-battle/state/${matchId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.getToken()}`,
            },
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to fetch battle state');
        }

        return data.data;
    }

    /**
     * Get active (ongoing) battles.
     */
    async getActiveBattles(): Promise<ActiveBattle[]> {
        const response = await fetch('/api/v1/turn-battle/active', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.getToken()}`,
            },
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to fetch active battles');
        }

        return data.data.battles;
    }

    private getToken(): string {
        // Token is stored in localStorage by AuthContext
        return localStorage.getItem('autobattler_token') || '';
    }
}

export const turnBattleApi = new TurnBattleApi();
export default turnBattleApi;
