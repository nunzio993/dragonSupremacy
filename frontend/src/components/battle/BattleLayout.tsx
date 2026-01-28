/**
 * BattleLayout Component - Pokémon 1v1 Style
 * 
 * Layout:
 * - Arena: Your active (bottom-left) vs Enemy active (top-right)
 * - Bench Panel: Your bench creatures (small, clickable for swap)
 * - Action Panel: Moves + Switch
 */
import { useState, useEffect, useRef } from 'react';
import { BattleState, BattleRewardPayload, CreatureInstance } from '@nft-autobattler/shared-types';
import { CreaturePanel } from './CreaturePanel';
import { ActionPanel } from './ActionPanel';
import './battle.css';

interface BattleLayoutProps {
    battleState: BattleState;
    onChooseMove: (moveId: string, targetInstanceId?: string) => void;
    onSwitch: (instanceId: string) => void;
    disabled: boolean;
    lastRewards?: BattleRewardPayload | null;
    onBackToHome: () => void;
    onBattleAgain: () => void;
}

const ATTACK_DISPLAY_MS = 1500;

export function BattleLayout({
    battleState,
    onChooseMove,
    onSwitch,
    disabled,
    lastRewards,
    onBackToHome,
    onBattleAgain,
}: BattleLayoutProps) {
    const isFinished = battleState.result !== 'ONGOING';
    const playerSide = battleState.player1;
    const opponentSide = battleState.player2;

    // Animation state
    const [phase, setPhase] = useState<'IDLE' | 'YOUR_TURN' | 'ENEMY_TURN'>('IDLE');
    const [currentMessage, setCurrentMessage] = useState<string>('');

    // Forced swap state (when active faints)
    const [mustSwap, setMustSwap] = useState(false);

    const lastTurnRef = useRef(battleState.turnNumber);

    // Check if we need to force a swap (active is null or fainted but bench has alive)
    useEffect(() => {
        const activeIsDead = !playerSide.active || playerSide.active.isFainted;
        const hasAliveBench = playerSide.bench.some(c => !c.isFainted);

        if (activeIsDead && hasAliveBench && !isFinished) {
            setMustSwap(true);
        } else {
            setMustSwap(false);
        }
    }, [playerSide.active, playerSide.bench, isFinished]);

    // Animation on new turn
    useEffect(() => {
        if (battleState.turnNumber > lastTurnRef.current) {
            lastTurnRef.current = battleState.turnNumber;

            const events = battleState.lastTurnEvents.filter(
                e => e.type !== 'TURN_START' && e.type !== 'TURN_END' && e.description
            );

            if (events.length === 0) {
                setPhase('IDLE');
                return;
            }

            const playerEvents = events.filter(e => e.sourcePlayer === 1);
            const enemyEvents = events.filter(e => e.sourcePlayer === 2);

            if (playerEvents.length > 0) {
                setPhase('YOUR_TURN');
                setCurrentMessage(playerEvents.map(e => e.description).join(' → '));
            }

            setTimeout(() => {
                if (enemyEvents.length > 0) {
                    setPhase('ENEMY_TURN');
                    setCurrentMessage(enemyEvents.map(e => e.description).join(' → '));
                }
            }, ATTACK_DISPLAY_MS);

            setTimeout(() => {
                setPhase('IDLE');
                setCurrentMessage('');
            }, ATTACK_DISPLAY_MS * 2);
        }
    }, [battleState.turnNumber, battleState.lastTurnEvents]);

    const handleMoveSelect = (moveId: string) => {
        // Always attack enemy's active (Pokémon style)
        onChooseMove(moveId);
    };

    const handleBenchSwap = (instanceId: string) => {
        onSwitch(instanceId);
        setMustSwap(false);
    };

    const isAnimating = phase !== 'IDLE';
    const canAct = !isFinished && !isAnimating && !disabled && !mustSwap;


    // All player creatures for display (active + bench + fallen)
    const allPlayerCreatures: CreatureInstance[] = [];
    if (playerSide.active) allPlayerCreatures.push(playerSide.active);
    allPlayerCreatures.push(...playerSide.bench);
    allPlayerCreatures.push(...(playerSide.fallen || []));

    const result = battleState.result === 'PLAYER1_WIN'
        ? { text: '🎉 Victory!', className: 'result-win' }
        : battleState.result === 'PLAYER2_WIN'
            ? { text: '💀 Defeat', className: 'result-lose' }
            : battleState.result === 'DRAW'
                ? { text: '🤝 Draw', className: 'result-draw' }
                : { text: '', className: '' };

    return (
        <div className="battle-layout">
            {/* Header */}
            <header className="battle-header">
                <span className="turn-badge">Turn {battleState.turnNumber}</span>
                <div className="turn-indicator">
                    {phase === 'YOUR_TURN' && <span className="phase-you">⚔️ YOU ATTACK</span>}
                    {phase === 'ENEMY_TURN' && <span className="phase-enemy">💥 ENEMY ATTACKS</span>}
                    {phase === 'IDLE' && !isFinished && !mustSwap && <span className="phase-idle">Your move...</span>}
                    {mustSwap && <span className="phase-swap">⚠️ Choose replacement!</span>}
                </div>
            </header>

            {/* Attack Message Overlay */}
            {isAnimating && currentMessage && (
                <div className={`attack-overlay ${phase.toLowerCase().replace('_', '-')}`}>
                    <div className="attack-message">{currentMessage}</div>
                </div>
            )}

            {/* Arena: 1v1 */}
            <main className="arena-1v1">
                {/* Enemy Active */}
                <div className={`arena-side enemy-arena ${phase === 'ENEMY_TURN' ? 'attacking' : ''}`}>
                    <div className="arena-label">🤖 ENEMY</div>
                    {opponentSide.active ? (
                        <CreaturePanel
                            side="OPPONENT"
                            creature={opponentSide.active}
                            isActive={true}
                            isAttacking={phase === 'ENEMY_TURN'}
                            size="md"
                        />
                    ) : (
                        <div className="no-active">No active</div>
                    )}
                </div>

                <div className="arena-vs">VS</div>

                {/* Your Active */}
                <div className={`arena-side player-arena ${phase === 'YOUR_TURN' ? 'attacking' : ''}`}>
                    <div className="arena-label">👤 YOU</div>
                    {playerSide.active && !playerSide.active.isFainted ? (
                        <CreaturePanel
                            side="PLAYER"
                            creature={playerSide.active}
                            isActive={true}
                            isAttacking={phase === 'YOUR_TURN'}
                            size="md"
                        />
                    ) : (
                        <div className="no-active">💀 Fainted</div>
                    )}
                </div>
            </main>

            {/* Bottom Panel: Bench + Actions */}
            <footer className="bottom-panel">
                {/* Bench */}
                <div className="bench-panel">
                    <div className="bench-label">Bench</div>
                    <div className="bench-creatures">
                        {allPlayerCreatures.slice(1).map(c => {
                            const canSwap = !c.isFainted && !isAnimating && !disabled;
                            return (
                                <div
                                    key={c.instanceId}
                                    className={`bench-slot ${c.isFainted ? 'fainted' : ''} ${canSwap ? 'selectable' : ''}`}
                                    onClick={() => canSwap && handleBenchSwap(c.instanceId)}
                                    style={{ cursor: canSwap ? 'pointer' : 'default' }}
                                >
                                    <img
                                        src={c.isFainted ? '/creature-dead.png' : '/creature-mock.png'}
                                        alt={c.creatureDefinitionId}
                                        className="bench-sprite"
                                    />
                                    <span className="bench-hp">
                                        {c.isFainted ? 'KO' : `${c.currentHp}/${c.maxHp}`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                {canAct && (
                    <div className="action-panel-wrapper">
                        <ActionPanel
                            activeCreature={playerSide.active}
                            onChooseMove={handleMoveSelect}
                            disabled={disabled}
                        />
                    </div>
                )}

                {/* Forced Swap Selection */}
                {mustSwap && (
                    <div className="forced-swap-message">
                        <span>Your creature fainted! Select a replacement from bench.</span>
                    </div>
                )}
            </footer>

            {/* Result */}
            {isFinished && !isAnimating && (
                <div className="result-overlay">
                    <div className="result-card">
                        <h2 className={`result-title ${result.className}`}>{result.text}</h2>
                        <p className="result-turns">{battleState.turnNumber} turns</p>

                        {lastRewards && (
                            <div className="rewards-section">
                                <div className="rewards-grid">
                                    <div className="reward-item">
                                        <span>⭐ +{lastRewards.xpGained} XP</span>
                                    </div>
                                    <div className="reward-item">
                                        <span>🪙 +{lastRewards.coinsGained} Coins</span>
                                    </div>
                                </div>
                                {lastRewards.leveledUp && (
                                    <div className="level-up-banner">
                                        🎊 Level {lastRewards.newLevel}!
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="result-actions">
                            <button className="btn btn-primary" onClick={onBackToHome}>Home</button>
                            <button className="btn btn-secondary" onClick={onBattleAgain}>Again</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BattleLayout;
