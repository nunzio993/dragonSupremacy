/**
 * TurnBattleScreen
 *
 * Main screen for interactive turn-based PvE battles.
 * Uses modular components from components/battle/ and the useTurnBattle hook.
 *
 * Responsibilities:
 * - Redirect to PreMatch if no active battle
 * - Render BattleLayout with all battle UI
 * - Handle loading and error states
 * - Navigate on battle end
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTurnBattle } from '../hooks/useTurnBattle';
import { useEconomy } from '../contexts/EconomyContext';
import { BattleLayout } from '../components/battle';
import '../components/battle/battle.css';

function TurnBattleScreen() {
    const navigate = useNavigate();
    const {
        matchId,
        battleState,
        loading,
        submittingAction,
        error,
        lastRewards,
        sendMove,
        sendSwitch,
        reset,
        clearRewards,
    } = useTurnBattle();
    const { refreshEconomy } = useEconomy();

    // Redirect if no battle loaded
    useEffect(() => {
        if (!matchId || !battleState) {
            navigate('/pre-match');
        }
    }, [matchId, battleState, navigate]);

    // Handlers for result actions
    const handleBackToHome = () => {
        clearRewards();
        refreshEconomy();
        reset();
        navigate('/');
    };

    const handleBattleAgain = () => {
        clearRewards();
        refreshEconomy();
        reset();
        navigate('/pre-match');
    };

    // Loading state (no battle yet)
    if (!battleState) {
        return (
            <div className="battle-layout">
                <div className="loading-overlay">
                    <div className="loading-spinner" />
                    <p>Loading battle...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <BattleLayout
                battleState={battleState}
                onChooseMove={sendMove}
                onSwitch={sendSwitch}
                disabled={loading || submittingAction}
                lastRewards={lastRewards}
                onBackToHome={handleBackToHome}
                onBattleAgain={handleBattleAgain}
            />

            {/* Loading Overlay */}
            {(loading || submittingAction) && (
                <div className="loading-overlay">
                    <div className="loading-spinner" />
                    <p>Processing turn...</p>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="error-banner">
                    <span>⚠️ {error}</span>
                </div>
            )}
        </>
    );
}

export default TurnBattleScreen;
