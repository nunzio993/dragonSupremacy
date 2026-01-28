/**
 * Economy Context
 *
 * Provides global access to player's economy state (XP, level, coins).
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PlayerEconomyState } from '@nft-autobattler/shared-types';
import { getEconomyState } from '../services/economyApi';
import { useAuth } from './AuthContext';

interface EconomyContextType {
    /** Current economy state */
    economy: PlayerEconomyState | null;
    /** Loading state */
    loading: boolean;
    /** Error message if any */
    error: string | null;
    /** Refresh economy state from server */
    refreshEconomy: () => Promise<void>;
}

const EconomyContext = createContext<EconomyContextType | null>(null);

const DEFAULT_ECONOMY: PlayerEconomyState = {
    xp: 0,
    level: 1,
    coins: 0,
    xpToNextLevel: 100,
};

export function EconomyProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [economy, setEconomy] = useState<PlayerEconomyState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshEconomy = useCallback(async () => {
        if (!isAuthenticated) return;

        setLoading(true);
        setError(null);

        try {
            const state = await getEconomyState();
            setEconomy(state);
        } catch (err) {
            console.error('[Economy] Failed to fetch state:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch economy');
            // Use default values on error
            setEconomy(DEFAULT_ECONOMY);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // Fetch economy state on mount and when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            refreshEconomy();
        }
    }, [isAuthenticated, refreshEconomy]);

    return (
        <EconomyContext.Provider
            value={{
                economy,
                loading,
                error,
                refreshEconomy,
            }}
        >
            {children}
        </EconomyContext.Provider>
    );
}

export function useEconomy(): EconomyContextType {
    const context = useContext(EconomyContext);
    if (!context) {
        throw new Error('useEconomy must be used within EconomyProvider');
    }
    return context;
}
