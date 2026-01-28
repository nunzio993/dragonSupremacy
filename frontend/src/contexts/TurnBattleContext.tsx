/**
 * Turn Battle Context
 *
 * Manages the state of an active turn-based battle.
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { BattleState, PlayerAction, BattleRewardPayload } from '@nft-autobattler/shared-types';
import turnBattleApi from '../services/turnBattleApi';

interface TurnBattleContextType {
    // State
    matchId: string | null;
    battleState: BattleState | null;
    loading: boolean;
    error: string | null;
    /** Rewards received when battle ended */
    lastRewards: BattleRewardPayload | null;

    // Actions
    initBattle: (matchId: string, state: BattleState) => void;
    sendAction: (action: PlayerAction) => Promise<void>;
    resetBattle: () => void;
    refreshState: () => Promise<void>;
    clearRewards: () => void;
}

const TurnBattleContext = createContext<TurnBattleContextType | null>(null);

export function TurnBattleProvider({ children }: { children: ReactNode }) {
    const [matchId, setMatchId] = useState<string | null>(null);
    const [battleState, setBattleState] = useState<BattleState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastRewards, setLastRewards] = useState<BattleRewardPayload | null>(null);

    const initBattle = useCallback((id: string, state: BattleState) => {
        setMatchId(id);
        setBattleState(state);
        setError(null);
        setLastRewards(null);
    }, []);

    const sendAction = useCallback(
        async (action: PlayerAction) => {
            if (!matchId || !battleState) {
                setError('No active battle');
                return;
            }

            if (battleState.result !== 'ONGOING') {
                setError('Battle has already ended');
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await turnBattleApi.sendAction(matchId, action);
                setBattleState(response.state);

                // Store rewards if battle ended
                if (response.rewards) {
                    setLastRewards(response.rewards);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to send action';
                setError(message);
                throw err;
            } finally {
                setLoading(false);
            }
        },
        [matchId, battleState]
    );

    const refreshState = useCallback(async () => {
        if (!matchId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await turnBattleApi.fetchState(matchId);
            setBattleState(response.state);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to refresh state';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [matchId]);

    const resetBattle = useCallback(() => {
        setMatchId(null);
        setBattleState(null);
        setError(null);
        setLoading(false);
        setLastRewards(null);
    }, []);

    const clearRewards = useCallback(() => {
        setLastRewards(null);
    }, []);

    return (
        <TurnBattleContext.Provider
            value={{
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
            }}
        >
            {children}
        </TurnBattleContext.Provider>
    );
}

export function useTurnBattle(): TurnBattleContextType {
    const context = useContext(TurnBattleContext);
    if (!context) {
        throw new Error('useTurnBattle must be used within a TurnBattleProvider');
    }
    return context;
}

export default TurnBattleContext;
