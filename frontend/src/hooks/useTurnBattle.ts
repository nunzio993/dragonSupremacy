/**
 * useTurnBattle Hook
 *
 * Custom hook for managing turn-based battle state and actions.
 * Wraps TurnBattleContext with additional convenience methods.
 */
import { useState, useCallback } from 'react';
import { useTurnBattle as useTurnBattleContext } from '../contexts/TurnBattleContext';
import { PlayerAction } from '@nft-autobattler/shared-types';

export interface UseTurnBattleReturn {
    // State
    matchId: string | null;
    battleState: ReturnType<typeof useTurnBattleContext>['battleState'];
    loading: boolean;
    submittingAction: boolean;
    error: string | null;
    lastRewards: ReturnType<typeof useTurnBattleContext>['lastRewards'];

    // Actions
    sendMove: (moveId: string, targetInstanceId?: string) => Promise<void>;
    sendSwitch: (instanceId: string) => Promise<void>;
    refresh: () => Promise<void>;
    reset: () => void;
    clearRewards: () => void;

    // Init (for PreMatchScreen)
    init: ReturnType<typeof useTurnBattleContext>['initBattle'];
}

export function useTurnBattle(): UseTurnBattleReturn {
    const context = useTurnBattleContext();
    const [submittingAction, setSubmittingAction] = useState(false);

    const {
        matchId,
        battleState,
        loading,
        error,
        lastRewards,
        initBattle,
        sendAction,
        resetBattle,
        refreshState,
        clearRewards,
    } = context;

    /**
     * Send a move action to the backend.
     */
    const sendMove = useCallback(async (moveId: string, targetInstanceId?: string) => {
        if (!battleState || !matchId) return;
        if (battleState.result !== 'ONGOING') return;

        const action: PlayerAction = {
            playerId: battleState.player1.playerId,
            type: 'USE_MOVE',
            moveId,
            targetPlayer: 2,
            targetInstanceId,
        };

        setSubmittingAction(true);
        try {
            await sendAction(action);
        } finally {
            setSubmittingAction(false);
        }
    }, [battleState, matchId, sendAction]);

    /**
     * Send a switch action to the backend.
     */
    const sendSwitch = useCallback(async (instanceId: string) => {
        if (!battleState || !matchId) return;
        if (battleState.result !== 'ONGOING') return;

        const action: PlayerAction = {
            playerId: battleState.player1.playerId,
            type: 'SWITCH',
            switchToInstanceId: instanceId,
        };

        setSubmittingAction(true);
        try {
            await sendAction(action);
        } finally {
            setSubmittingAction(false);
        }
    }, [battleState, matchId, sendAction]);

    return {
        matchId,
        battleState,
        loading,
        submittingAction,
        error,
        lastRewards,
        sendMove,
        sendSwitch,
        refresh: refreshState,
        reset: resetBattle,
        clearRewards,
        init: initBattle,
    };
}

export default useTurnBattle;
