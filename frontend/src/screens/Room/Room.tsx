/**
 * Room Screen
 * Shows waiting state and battle when both players are ready
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { getSocket, initSocket, TurnUpdate, BattleEnd, BattleCreature } from '../../services/socket';
import './Room.css';

type RoomPhase = 'waiting' | 'ready' | 'battle' | 'ended';

interface MoveInfo {
    moveId: string;
    name: string;
    power: number;
    category: string;
    accuracy: number;
    type: string;
    onCooldown: boolean;
}

interface RoomState {
    phase: RoomPhase;
    isHost: boolean;
    opponentConnected: boolean;
    yourCreature?: BattleCreature;
    opponentCreature?: BattleCreature;
    turnNumber: number;
    yourTurn: boolean;
    availableMoves: MoveInfo[];
    battleLog: string[];
    winner?: string;
    youWon?: boolean;
}

export function RoomScreen() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { address, isConnected } = useWallet();

    const [roomState, setRoomState] = useState<RoomState>({
        phase: 'waiting',
        isHost: false,
        opponentConnected: false,
        turnNumber: 0,
        yourTurn: false,
        availableMoves: [],
        battleLog: [],
    });
    const [_selectedMove, setSelectedMove] = useState<string>('');
    const [hoveredMove, setHoveredMove] = useState<MoveInfo | null>(null);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isAttacking, setIsAttacking] = useState(false);

    // Calculate estimated damage for a move (matches backend balanced formula)
    const calcEstimatedDamage = useCallback((move: MoveInfo): number => {
        if (move.power === 0 || move.category === 'STATUS') {
            return 0;
        }

        const yourCreature = roomState.yourCreature;
        const opponentCreature = roomState.opponentCreature;

        if (!yourCreature || !opponentCreature) {
            return move.power;
        }

        // Attack stat: STR for physical, INT for special
        const atkStat = move.category === 'PHYSICAL'
            ? (yourCreature.attributes?.STR ?? 60)
            : (yourCreature.attributes?.INT ?? 60);

        // Defense stat: END for physical, REF for special
        const defStat = move.category === 'PHYSICAL'
            ? (opponentCreature.attributes?.END ?? 50)
            : (opponentCreature.attributes?.REF ?? 50);

        // BALANCED: sqrt of stat ratio
        const statRatio = Math.sqrt(Math.max(0.25, atkStat / Math.max(1, defStat)));

        // Estimated damage (average, no crit)
        const damage = move.power * statRatio;

        return Math.max(1, Math.round(damage));
    }, [roomState.yourCreature, roomState.opponentCreature]);

    // Initialize socket and join room events
    useEffect(() => {
        if (!isConnected || !address || !roomId) return;

        const socket = getSocket() || initSocket(address);

        // Request current room state on mount
        socket.emit('get_room_state', { roomId }, (response: {
            success: boolean;
            state?: string;
            hasOpponent?: boolean;
        }) => {
            console.log('[Room] Got room state:', response);
            if (response.success && response.hasOpponent) {
                setRoomState(prev => ({ ...prev, phase: 'ready', opponentConnected: true }));
            }
        });

        // Listen for room events
        socket.on('opponent_joined', (data: { roomId: string; opponentPlayerId: string }) => {
            console.log('[Room] Opponent joined!', data);
            setRoomState(prev => ({ ...prev, phase: 'ready', opponentConnected: true }));
        });

        // Guest receives this when they join successfully
        socket.on('joined_room', (data: { roomId: string; hostPlayerId: string }) => {
            console.log('[Room] Joined room!', data);
            setRoomState(prev => ({ ...prev, phase: 'ready', opponentConnected: true }));
        });

        socket.on('battle_start', (data: {
            yourCreature: BattleCreature;
            opponentCreature: BattleCreature;
            yourTurn: boolean;
        }) => {
            setRoomState(prev => ({
                ...prev,
                phase: 'battle',
                yourCreature: data.yourCreature,
                opponentCreature: data.opponentCreature,
                yourTurn: data.yourTurn,
                turnNumber: 1,
            }));
            setTimeLeft(60);
        });

        socket.on('turn_update', (data: TurnUpdate) => {
            const logs = data.actions.map(a =>
                `${a.attackerName} used ${a.moveName}${a.hit ? ` for ${a.damage} damage${a.critical ? ' (CRIT!)' : ''}` : ' but missed!'}`
            );

            setRoomState(prev => ({
                ...prev,
                turnNumber: data.turnNumber,
                yourTurn: false, // Wait for your_turn event to enable moves
                battleLog: [...prev.battleLog, ...logs],
                yourCreature: prev.yourCreature ? {
                    ...prev.yourCreature,
                    currentHp: data.yourHp,
                    maxHp: data.yourMaxHp,
                } : undefined,
                opponentCreature: prev.opponentCreature ? {
                    ...prev.opponentCreature,
                    currentHp: data.opponentHp,
                    maxHp: data.opponentMaxHp,
                } : undefined,
            }));
            setSelectedMove('');
        });

        // Listen for your_turn event (turn-based system)
        socket.on('your_turn', (data: {
            roomId: string;
            turnNumber: number;
            timeRemainingMs: number;
            availableMoves: MoveInfo[];
        }) => {
            console.log('[Room] Your turn!', data);

            // Ensure at least one move is clickable (fallback safety)
            let moves = data.availableMoves;
            const allOnCooldown = moves.every(m => m.onCooldown);
            if (allOnCooldown && moves.length > 0) {
                // Force first move to be available
                moves = moves.map((m, idx) => ({
                    ...m,
                    onCooldown: idx === 0 ? false : m.onCooldown
                }));
                console.log('[Room] All moves on cooldown, forcing first move available');
            }

            setRoomState(prev => ({
                ...prev,
                yourTurn: true,
                availableMoves: moves,
            }));
            setTimeLeft(Math.floor(data.timeRemainingMs / 1000));
        });

        socket.on('battle_end', (data: BattleEnd) => {
            setRoomState(prev => ({
                ...prev,
                phase: 'ended',
                winner: data.winner,
                youWon: data.youWon,
                battleLog: [...prev.battleLog, `Battle ended! ${data.youWon ? 'You won!' : 'You lost.'}`],
            }));
        });

        socket.on('opponent_left', () => {
            setRoomState(prev => ({
                ...prev,
                phase: 'ended',
                youWon: true,
                battleLog: [...prev.battleLog, 'Opponent disconnected. You win!'],
            }));
        });

        return () => {
            socket.off('opponent_joined');
            socket.off('joined_room');
            socket.off('battle_start');
            socket.off('turn_update');
            socket.off('your_turn');
            socket.off('battle_end');
            socket.off('opponent_left');
        };
    }, [isConnected, address, roomId]);

    // Timer countdown - only runs when it's your turn
    useEffect(() => {
        if (roomState.phase !== 'battle' || !roomState.yourTurn) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) return 0; // Don't reset, let backend handle timeout
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [roomState.phase, roomState.yourTurn]);

    // Leave room
    const handleLeave = useCallback(() => {
        const socket = getSocket();
        if (socket && roomId) {
            socket.emit('leave_room', { roomId });
        }
        navigate('/lobby');
    }, [roomId, navigate]);

    // Helper function to get HP bar class based on percentage
    const getHpClass = (current: number, max: number): string => {
        const percentage = (current / max) * 100;
        if (percentage <= 25) return 'critical';
        if (percentage <= 50) return 'warning';
        return '';
    };

    // Render based on phase
    const renderContent = () => {
        switch (roomState.phase) {
            case 'waiting':
                return (
                    <div className="room-waiting">
                        <div className="waiting-spinner"></div>
                        <h2>Waiting for opponent...</h2>
                        <p>Room ID: {roomId?.slice(0, 8)}...</p>
                        <button className="leave-btn" onClick={handleLeave}>
                            Cancel & Leave
                        </button>
                    </div>
                );

            case 'ready':
                return (
                    <div className="room-ready">
                        <h2>🎮 Opponent Found!</h2>
                        <p>Battle starting soon...</p>
                    </div>
                );

            case 'battle':
                return (
                    <div className="room-battle">
                        {/* Header with turn info */}
                        <div className="battle-header">
                            <div className={`turn-info ${roomState.yourTurn ? 'your-turn' : ''}`}>
                                Turn {roomState.turnNumber}
                                {roomState.yourTurn ? ' — YOUR TURN!' : ' — Waiting...'}
                            </div>
                            {roomState.yourTurn ? (
                                <div className="timer">{timeLeft}s</div>
                            ) : (
                                <div className="timer waiting">⏳</div>
                            )}
                        </div>

                        {/* Battlefield - Pokémon Style */}
                        <div className="battle-arena">
                            {/* Enemy Side - Top Right */}
                            <div className="enemy-side">
                                <div className="enemy-hp-panel">
                                    <div className="hp-panel-header">
                                        <span className="creature-name-hp">
                                            {roomState.opponentCreature?.name || 'Enemy'}
                                        </span>
                                        <span className="creature-level">Lv.50</span>
                                    </div>
                                    <div className="hp-bar-container">
                                        <span className="hp-label">HP</span>
                                        <div className="hp-bar">
                                            <div
                                                className={`hp-fill ${getHpClass(roomState.opponentCreature?.currentHp || 0, roomState.opponentCreature?.maxHp || 1)}`}
                                                style={{
                                                    width: `${((roomState.opponentCreature?.currentHp || 0) / (roomState.opponentCreature?.maxHp || 1)) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="hp-text-small">
                                        {roomState.opponentCreature?.currentHp} / {roomState.opponentCreature?.maxHp}
                                    </div>
                                </div>
                                <div className="enemy-creature">
                                    <img src="/creature-attack.png" alt={roomState.opponentCreature?.name} />
                                </div>
                            </div>

                            {/* Player Side - Bottom Left */}
                            <div className="player-side">
                                <div className={`player-creature ${isAttacking ? 'attacking' : ''}`}>
                                    <img src="/creature-mock.png" alt={roomState.yourCreature?.name} />
                                </div>
                                <div className="player-hp-panel">
                                    <div className="hp-panel-header">
                                        <span className="creature-name-hp">
                                            {roomState.yourCreature?.name || 'Your Creature'}
                                        </span>
                                        <span className="creature-level">Lv.50</span>
                                    </div>
                                    <div className="hp-bar-container">
                                        <span className="hp-label">HP</span>
                                        <div className="hp-bar">
                                            <div
                                                className={`hp-fill ${getHpClass(roomState.yourCreature?.currentHp || 0, roomState.yourCreature?.maxHp || 1)}`}
                                                style={{
                                                    width: `${((roomState.yourCreature?.currentHp || 0) / (roomState.yourCreature?.maxHp || 1)) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="hp-text-small">
                                        {roomState.yourCreature?.currentHp} / {roomState.yourCreature?.maxHp}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Panel - Bottom */}
                        <div className="action-panel">
                            {/* Battle Log */}
                            <div className="battle-log-panel">
                                <h4>Battle Log</h4>
                                <div className="battle-log">
                                    {roomState.battleLog.slice(-4).map((log, i) => (
                                        <div key={i} className="log-entry">{log}</div>
                                    ))}
                                    {roomState.battleLog.length === 0 && (
                                        <div className="log-entry">
                                            {roomState.yourTurn ? 'What will you do?' : 'Waiting for opponent...'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Move Buttons + Info Panel */}
                            <div className="moves-section">
                                <div className="moves-panel">
                                    {roomState.availableMoves.map(move => (
                                        <button
                                            key={move.moveId}
                                            className={`move-btn ${hoveredMove?.moveId === move.moveId ? 'selected' : ''}`}
                                            onMouseEnter={() => setHoveredMove(move)}
                                            onClick={() => {
                                                if (roomState.yourTurn && !move.onCooldown) {
                                                    setSelectedMove(move.moveId);
                                                    // Trigger attack animation
                                                    setIsAttacking(true);
                                                    setTimeout(() => setIsAttacking(false), 500);
                                                    // Submit the action
                                                    const socket = getSocket();
                                                    if (socket && roomId) {
                                                        socket.emit('submit_action', {
                                                            roomId,
                                                            actionType: 'ATTACK',
                                                            moveId: move.moveId,
                                                        });
                                                        setRoomState(prev => ({ ...prev, yourTurn: false }));
                                                    }
                                                }
                                            }}
                                            disabled={move.onCooldown || !roomState.yourTurn}
                                        >
                                            <span className="move-name">{move.name}</span>
                                            <span className="move-stats">
                                                DMG ~{move.category === 'STATUS' ? '—' : calcEstimatedDamage(move)} | ACC {move.accuracy}%
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {/* Move Info Panel */}
                                {hoveredMove && (
                                    <div className="move-info-panel">
                                        <h3>{hoveredMove.name}</h3>
                                        <div className="move-info-grid">
                                            <div className="info-row">
                                                <span className="info-label">Type</span>
                                                <span className={`info-value type-${hoveredMove.type.toLowerCase()}`}>
                                                    {hoveredMove.type}
                                                </span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-label">Category</span>
                                                <span className="info-value">{hoveredMove.category}</span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-label">Est. Damage</span>
                                                <span className="info-value power">
                                                    {hoveredMove.category === 'STATUS' ? '—' : `~${calcEstimatedDamage(hoveredMove)}`}
                                                </span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-label">Accuracy</span>
                                                <span className="info-value">{hoveredMove.accuracy}%</span>
                                            </div>
                                        </div>
                                        {hoveredMove.onCooldown && (
                                            <div className="cooldown-warning">⏳ On Cooldown</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'ended':
                // Show arena with victory/defeat overlay so player sees HP at 0
                return (
                    <div className="room-battle">
                        {/* Header shows "Battle Over" */}
                        <div className="battle-header">
                            <div className="turn-info battle-over">
                                ⚔️ Battle Over
                            </div>
                        </div>

                        {/* Battlefield still visible - shows final HP state */}
                        <div className="battle-arena">
                            {/* Enemy Side */}
                            <div className="enemy-side">
                                <div className="enemy-hp-panel">
                                    <div className="hp-panel-header">
                                        <span className="creature-name-hp">
                                            {roomState.opponentCreature?.name || 'Enemy'}
                                        </span>
                                    </div>
                                    <div className="hp-bar">
                                        <div
                                            className={`hp-fill ${getHpClass(roomState.opponentCreature?.currentHp || 0, roomState.opponentCreature?.maxHp || 1)}`}
                                            style={{
                                                width: `${((roomState.opponentCreature?.currentHp || 0) / (roomState.opponentCreature?.maxHp || 1)) * 100}%`
                                            }}
                                        />
                                    </div>
                                    <span className="hp-text">
                                        {roomState.opponentCreature?.currentHp || 0} / {roomState.opponentCreature?.maxHp || 0}
                                    </span>
                                </div>
                            </div>

                            {/* Player Side */}
                            <div className="player-side">
                                <div className="player-hp-panel">
                                    <div className="hp-panel-header">
                                        <span className="creature-name-hp">
                                            {roomState.yourCreature?.name || 'Your Dragon'}
                                        </span>
                                    </div>
                                    <div className="hp-bar">
                                        <div
                                            className={`hp-fill ${getHpClass(roomState.yourCreature?.currentHp || 0, roomState.yourCreature?.maxHp || 1)}`}
                                            style={{
                                                width: `${((roomState.yourCreature?.currentHp || 0) / (roomState.yourCreature?.maxHp || 1)) * 100}%`
                                            }}
                                        />
                                    </div>
                                    <span className="hp-text">
                                        {roomState.yourCreature?.currentHp || 0} / {roomState.yourCreature?.maxHp || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Victory/Defeat Overlay */}
                        <div className="battle-result-overlay">
                            <div className={`result-banner ${roomState.youWon ? 'victory' : 'defeat'}`}>
                                <h1>{roomState.youWon ? '🏆 VICTORY!' : '💀 DEFEAT'}</h1>
                                <p>{roomState.youWon ? 'You earned 8 DGNE!' : 'Better luck next time!'}</p>
                                <button className="return-btn" onClick={() => navigate('/lobby')}>
                                    Return to Lobby
                                </button>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="room-screen">
            {renderContent()}
        </div>
    );
}
