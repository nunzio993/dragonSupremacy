import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import api from '../services/api';
import { MatchEvent, UnitState } from '@nft-autobattler/shared-types';
import './MatchScreen.css';

interface BattleUnit extends UnitState {
    name: string;
    rarity: string;
    shake: boolean;
    flash: boolean;
    attacking: boolean;
}

type MatchPhase = 'loading' | 'battle' | 'result';
type PlaybackSpeed = 0.5 | 1 | 2;

interface MatchResult {
    matchId: string;
    result: 'teamA' | 'teamB' | 'draw';
    events: MatchEvent[];
    totalTurns: number;
    finalState: any;
    xpGained: number;
}

function MatchScreen() {
    const navigate = useNavigate();
    const { getUnit } = useGameData();
    
    // Core state
    const [phase, setPhase] = useState<MatchPhase>('loading');
    const [error, setError] = useState<string | null>(null);
    const [teamA, setTeamA] = useState<BattleUnit[]>([]);
    const [teamB, setTeamB] = useState<BattleUnit[]>([]);
    const [events, setEvents] = useState<MatchEvent[]>([]);
    const [currentEventIndex, setCurrentEventIndex] = useState(0);
    const [result, setResult] = useState<'teamA' | 'teamB' | 'draw' | null>(null);
    const [xpGained, setXpGained] = useState(0);
    const [eventLog, setEventLog] = useState<string[]>([]);
    
    // Playback control state
    const [isPaused, setIsPaused] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
    const [isPlaybackComplete, setIsPlaybackComplete] = useState(false);
    
    // Tooltip state
    const [hoveredUnit, setHoveredUnit] = useState<BattleUnit | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    
    // Refs for controlling async playback
    const isPausedRef = useRef(isPaused);
    const playbackSpeedRef = useRef(playbackSpeed);
    const eventLogRef = useRef<HTMLDivElement>(null);
    const playbackAbortRef = useRef(false);
    const stepRequestRef = useRef(false);
    const matchDataRef = useRef<{
        events: MatchEvent[];
        initialTeamA: BattleUnit[];
        initialTeamB: BattleUnit[];
    } | null>(null);

    // Keep refs in sync with state
    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);
    
    useEffect(() => {
        playbackSpeedRef.current = playbackSpeed;
    }, [playbackSpeed]);

    useEffect(() => {
        startMatch();
        return () => {
            playbackAbortRef.current = true;
        };
    }, []);

    const initializeUnits = useCallback((finalState: any): { teamA: BattleUnit[], teamB: BattleUnit[] } => {
        const initTeamA = finalState.teamA.map((u: UnitState) => {
            const unitDef = getUnit(u.unitDefinitionId);
            return {
                ...u,
                currentHp: u.maxHp,
                isAlive: true,
                name: unitDef?.name || 'Unknown',
                rarity: unitDef?.rarity || 'common',
                shake: false,
                flash: false,
                attacking: false,
            };
        });

        const initTeamB = finalState.teamB.map((u: UnitState) => {
            const unitDef = getUnit(u.unitDefinitionId);
            return {
                ...u,
                currentHp: u.maxHp,
                isAlive: true,
                name: unitDef?.name || 'Unknown',
                rarity: unitDef?.rarity || 'common',
                shake: false,
                flash: false,
                attacking: false,
            };
        });

        return { teamA: initTeamA, teamB: initTeamB };
    }, [getUnit]);

    const startMatch = async () => {
        setError(null);
        setPhase('loading');
        
        try {
            const matchResult: MatchResult = await api.simulateMatch();
            const { teamA: initTeamA, teamB: initTeamB } = initializeUnits(matchResult.finalState);

            // Store initial state for restart
            matchDataRef.current = {
                events: matchResult.events,
                initialTeamA: initTeamA,
                initialTeamB: initTeamB,
            };

            setTeamA(initTeamA);
            setTeamB(initTeamB);
            setEvents(matchResult.events);
            setResult(matchResult.result);
            setXpGained(matchResult.xpGained);
            setPhase('battle');
            setIsPlaybackComplete(false);
            setCurrentEventIndex(0);
            setEventLog([]);

            // Start event playback after a short delay
            setTimeout(() => playEvents(matchResult.events, initTeamA, initTeamB), 500);
        } catch (err) {
            console.error('Match failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to start match');
            setPhase('loading');
        }
    };

    const delay = (ms: number) => new Promise((resolve) => {
        const adjustedMs = ms / playbackSpeedRef.current;
        setTimeout(resolve, adjustedMs);
    });

    const waitForUnpause = async () => {
        while (isPausedRef.current && !stepRequestRef.current && !playbackAbortRef.current) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    };

    const playEvents = async (
        allEvents: MatchEvent[],
        initialTeamA: BattleUnit[],
        initialTeamB: BattleUnit[]
    ) => {
        let currentA = [...initialTeamA];
        let currentB = [...initialTeamB];
        const log: string[] = [];

        for (let i = 0; i < allEvents.length; i++) {
            if (playbackAbortRef.current) return;
            
            // Wait if paused (unless stepping)
            await waitForUnpause();
            if (playbackAbortRef.current) return;
            
            // Clear step request after processing
            stepRequestRef.current = false;

            const event = allEvents[i];
            setCurrentEventIndex(i);

            // Process event
            switch (event.eventType) {
                case 'attack':
                    const attackerTeam = currentA.find((u) => u.instanceId === event.actorInstanceId) ? 'A' : 'B';
                    if (attackerTeam === 'A') {
                        currentA = currentA.map((u) =>
                            u.instanceId === event.actorInstanceId ? { ...u, attacking: true } : u
                        );
                        setTeamA([...currentA]);
                    } else {
                        currentB = currentB.map((u) =>
                            u.instanceId === event.actorInstanceId ? { ...u, attacking: true } : u
                        );
                        setTeamB([...currentB]);
                    }
                    log.push(event.description);
                    await delay(300);

                    // Reset attacking state
                    currentA = currentA.map((u) => ({ ...u, attacking: false }));
                    currentB = currentB.map((u) => ({ ...u, attacking: false }));
                    setTeamA([...currentA]);
                    setTeamB([...currentB]);
                    break;

                case 'damage':
                    const targetTeam = currentA.find((u) => u.instanceId === event.targetInstanceId) ? 'A' : 'B';
                    if (targetTeam === 'A') {
                        currentA = currentA.map((u) =>
                            u.instanceId === event.targetInstanceId
                                ? { ...u, currentHp: Math.max(0, u.currentHp - event.value), shake: true, flash: true }
                                : u
                        );
                        setTeamA([...currentA]);
                    } else {
                        currentB = currentB.map((u) =>
                            u.instanceId === event.targetInstanceId
                                ? { ...u, currentHp: Math.max(0, u.currentHp - event.value), shake: true, flash: true }
                                : u
                        );
                        setTeamB([...currentB]);
                    }
                    log.push(event.description);
                    await delay(400);

                    // Reset shake/flash
                    currentA = currentA.map((u) => ({ ...u, shake: false, flash: false }));
                    currentB = currentB.map((u) => ({ ...u, shake: false, flash: false }));
                    setTeamA([...currentA]);
                    setTeamB([...currentB]);
                    break;

                case 'death':
                    const deadTeam = currentA.find((u) => u.instanceId === event.actorInstanceId) ? 'A' : 'B';
                    if (deadTeam === 'A') {
                        currentA = currentA.map((u) =>
                            u.instanceId === event.actorInstanceId ? { ...u, isAlive: false } : u
                        );
                        setTeamA([...currentA]);
                    } else {
                        currentB = currentB.map((u) =>
                            u.instanceId === event.actorInstanceId ? { ...u, isAlive: false } : u
                        );
                        setTeamB([...currentB]);
                    }
                    log.push(`💀 ${event.description}`);
                    await delay(500);
                    break;

                case 'heal':
                    log.push(`💚 ${event.description}`);
                    await delay(200);
                    break;

                case 'passive_trigger':
                case 'effect_trigger':
                    log.push(`✨ ${event.description}`);
                    await delay(200);
                    break;

                case 'block':
                case 'dodge':
                    log.push(`🛡️ ${event.description}`);
                    await delay(300);
                    break;

                case 'revive':
                    const reviveTeam = currentA.find((u) => u.instanceId === event.actorInstanceId) ? 'A' : 'B';
                    if (reviveTeam === 'A') {
                        currentA = currentA.map((u) =>
                            u.instanceId === event.actorInstanceId
                                ? { ...u, isAlive: true, currentHp: event.value }
                                : u
                        );
                        setTeamA([...currentA]);
                    } else {
                        currentB = currentB.map((u) =>
                            u.instanceId === event.actorInstanceId
                                ? { ...u, isAlive: true, currentHp: event.value }
                                : u
                        );
                        setTeamB([...currentB]);
                    }
                    log.push(`🔥 ${event.description}`);
                    await delay(500);
                    break;

                case 'match_end':
                    log.push(`🏆 ${event.description}`);
                    break;
            }

            setEventLog([...log]);
        }

        // Show result
        setIsPlaybackComplete(true);
        setPhase('result');
    };

    // Playback control handlers
    const handlePlayPause = useCallback(() => {
        setIsPaused(prev => !prev);
    }, []);

    const handleSpeedChange = useCallback((speed: PlaybackSpeed) => {
        setPlaybackSpeed(speed);
    }, []);

    const handleStep = useCallback(() => {
        if (isPaused && !isPlaybackComplete) {
            stepRequestRef.current = true;
        }
    }, [isPaused, isPlaybackComplete]);

    const handleRestart = useCallback(() => {
        if (!matchDataRef.current) return;
        
        playbackAbortRef.current = true;
        
        setTimeout(() => {
            playbackAbortRef.current = false;
            const { events, initialTeamA, initialTeamB } = matchDataRef.current!;
            
            setTeamA([...initialTeamA]);
            setTeamB([...initialTeamB]);
            setCurrentEventIndex(0);
            setEventLog([]);
            setIsPlaybackComplete(false);
            setIsPaused(false);
            setPhase('battle');
            
            setTimeout(() => playEvents(events, initialTeamA, initialTeamB), 100);
        }, 100);
    }, []);

    const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // Timeline scrubbing - simplified version: just show position
        // Full implementation would require event snapshots for each state
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const targetIndex = Math.floor(percent * events.length);
        // For now, just indicate the position - full replay state reconstruction is complex
        console.log(`Timeline clicked at event ${targetIndex}/${events.length}`);
    }, [events.length]);

    // Tooltip handler
    const handleUnitHover = useCallback((unit: BattleUnit | null, event?: React.MouseEvent) => {
        setHoveredUnit(unit);
        if (unit && event) {
            setTooltipPosition({ x: event.clientX, y: event.clientY });
        }
    }, []);

    // Live status computed values
    const aliveCountA = useMemo(() => teamA.filter(u => u.isAlive).length, [teamA]);
    const aliveCountB = useMemo(() => teamB.filter(u => u.isAlive).length, [teamB]);
    const timelineProgress = useMemo(() => 
        events.length > 0 ? ((currentEventIndex + 1) / events.length) * 100 : 0, 
    [currentEventIndex, events.length]);

    // Scroll event log to bottom
    useEffect(() => {
        if (eventLogRef.current) {
            eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
        }
    }, [eventLog]);

    // Loading state with error
    if (phase === 'loading') {
        return (
            <div className="match-screen screen">
                <div className="match-loading">
                    {error ? (
                        <div className="error-container animate-fadeIn">
                            <div className="error-icon">⚠️</div>
                            <p className="error-message">{error}</p>
                            <div className="error-actions">
                                <button className="btn btn-primary" onClick={startMatch}>
                                    Retry
                                </button>
                                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                                    Back to Home
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="loading-spinner"></div>
                            <p>Preparing battle...</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="match-screen screen">
            {/* Live Battle Status */}
            <div className="battle-status-bar">
                <div className="status-team status-team-a">
                    <span className="status-label">Your Team</span>
                    <span className="status-count">{aliveCountA} / {teamA.length}</span>
                </div>
                <div className="status-vs">⚔️</div>
                <div className="status-team status-team-b">
                    <span className="status-label">Enemy</span>
                    <span className="status-count">{aliveCountB} / {teamB.length}</span>
                </div>
            </div>

            {/* Battlefield */}
            <div className="battlefield">
                {/* Team A (Left - Player) */}
                <div className="team team-a">
                    <h3 className="team-label">Your Team</h3>
                    <div className="team-units">
                        {teamA.map((unit) => (
                            <BattleUnitDisplay 
                                key={unit.instanceId} 
                                unit={unit}
                                onHover={handleUnitHover}
                            />
                        ))}
                    </div>
                </div>

                {/* VS Indicator */}
                <div className="vs-indicator">
                    <span>VS</span>
                </div>

                {/* Team B (Right - AI) */}
                <div className="team team-b">
                    <h3 className="team-label">Enemy Team</h3>
                    <div className="team-units">
                        {teamB.map((unit) => (
                            <BattleUnitDisplay 
                                key={unit.instanceId} 
                                unit={unit}
                                onHover={handleUnitHover}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Playback Controls */}
            <div className="playback-controls">
                <div className="controls-row">
                    <button 
                        className="control-btn" 
                        onClick={handleRestart}
                        title="Restart"
                        disabled={isPlaybackComplete && phase === 'result'}
                    >
                        ⏮️
                    </button>
                    <button 
                        className="control-btn control-btn-main" 
                        onClick={handlePlayPause}
                        title={isPaused ? 'Play' : 'Pause'}
                        disabled={isPlaybackComplete}
                    >
                        {isPaused ? '▶️' : '⏸️'}
                    </button>
                    <button 
                        className="control-btn" 
                        onClick={handleStep}
                        title="Step Forward"
                        disabled={!isPaused || isPlaybackComplete}
                    >
                        ⏭️
                    </button>
                </div>
                
                <div className="speed-controls">
                    <button 
                        className={`speed-btn ${playbackSpeed === 0.5 ? 'active' : ''}`}
                        onClick={() => handleSpeedChange(0.5)}
                    >
                        0.5x
                    </button>
                    <button 
                        className={`speed-btn ${playbackSpeed === 1 ? 'active' : ''}`}
                        onClick={() => handleSpeedChange(1)}
                    >
                        1x
                    </button>
                    <button 
                        className={`speed-btn ${playbackSpeed === 2 ? 'active' : ''}`}
                        onClick={() => handleSpeedChange(2)}
                    >
                        2x
                    </button>
                </div>

                <div className="timeline-container" onClick={handleTimelineClick}>
                    <div className="timeline-bar">
                        <div 
                            className="timeline-progress" 
                            style={{ width: `${timelineProgress}%` }}
                        />
                    </div>
                    <div className="timeline-info">
                        Event {currentEventIndex + 1} / {events.length}
                    </div>
                </div>
            </div>

            {/* Event Log */}
            <div className="event-log" ref={eventLogRef}>
                {eventLog.map((log, i) => (
                    <div key={i} className="log-entry animate-fadeIn">
                        {log}
                    </div>
                ))}
            </div>

            {/* Unit Tooltip */}
            {hoveredUnit && (
                <div 
                    className="unit-tooltip"
                    style={{ 
                        left: tooltipPosition.x + 10, 
                        top: tooltipPosition.y + 10 
                    }}
                >
                    <div className="tooltip-header">
                        <span className="tooltip-name">{hoveredUnit.name}</span>
                        <span className={`rarity-badge rarity-${hoveredUnit.rarity}`}>
                            {hoveredUnit.rarity}
                        </span>
                    </div>
                    <div className="tooltip-stats">
                        <div className="tooltip-stat">
                            <span className="stat-icon">❤️</span>
                            <span>{hoveredUnit.currentHp}/{hoveredUnit.maxHp}</span>
                        </div>
                        <div className="tooltip-stat">
                            <span className="stat-icon">⚔️</span>
                            <span>{hoveredUnit.atk}</span>
                        </div>
                        <div className="tooltip-stat">
                            <span className="stat-icon">💨</span>
                            <span>{hoveredUnit.spd}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Result Overlay */}
            {phase === 'result' && (
                <div className="result-overlay animate-fadeIn">
                    <div className="result-panel animate-slideUp">
                        <h2 className={`result-title ${result === 'teamA' ? 'victory' : result === 'teamB' ? 'defeat' : 'draw'}`}>
                            {result === 'teamA' ? '🏆 VICTORY!' : result === 'teamB' ? '💔 DEFEAT' : '🤝 DRAW'}
                        </h2>
                        <div className="result-stats">
                            <div className="stat-row">
                                <span>XP Gained</span>
                                <span className="xp-value">+{xpGained}</span>
                            </div>
                            <div className="stat-row">
                                <span>Total Events</span>
                                <span>{events.length}</span>
                            </div>
                        </div>
                        <div className="result-actions">
                            <button className="btn btn-secondary" onClick={handleRestart}>
                                Watch Replay
                            </button>
                            <button className="btn btn-primary" onClick={() => navigate('/pre-match')}>
                                Play Again
                            </button>
                            <button className="btn btn-secondary" onClick={() => navigate('/')}>
                                Home
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Memoized battle unit display component
const BattleUnitDisplay = memo(function BattleUnitDisplay({ 
    unit, 
    onHover 
}: { 
    unit: BattleUnit;
    onHover: (unit: BattleUnit | null, event?: React.MouseEvent) => void;
}) {
    const hpPercent = Math.max(0, (unit.currentHp / unit.maxHp) * 100);

    const classes = [
        'battle-unit',
        !unit.isAlive && 'dead',
        unit.shake && 'shake',
        unit.flash && 'flash',
        unit.attacking && 'attacking',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div 
            className={classes}
            onMouseEnter={(e) => onHover(unit, e)}
            onMouseLeave={() => onHover(null)}
        >
            <div className={`unit-avatar-battle rarity-glow-${unit.rarity}`}>
                <span className="unit-letter">{unit.name[0]}</span>
            </div>
            <div className="unit-info">
                <span className="unit-name">{unit.name}</span>
                <div className="hp-bar">
                    <div
                        className="hp-bar-fill"
                        style={{
                            width: `${hpPercent}%`,
                            background: hpPercent > 50 ? 'var(--color-success)' : hpPercent > 25 ? 'var(--color-warning)' : 'var(--color-danger)',
                        }}
                    />
                </div>
                <div className="unit-mini-stats">
                    <span className="mini-stat">❤️ {unit.currentHp}</span>
                    <span className="mini-stat">⚔️ {unit.atk}</span>
                </div>
            </div>
        </div>
    );
});

export default MatchScreen;
