import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './HistoryScreen.css';

interface MatchHistoryEntry {
    matchId: string;
    result: 'teamA' | 'teamB' | 'draw';
    opponentType: string;
    totalTurns: number;
    xpGained: number;
    createdAt: string;
}

function HistoryScreen() {
    const navigate = useNavigate();
    const [matches, setMatches] = useState<MatchHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await api.getMatchHistory();
            setMatches(data);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getResultDisplay = (result: string) => {
        switch (result) {
            case 'teamA':
                return { text: 'Victory', emoji: '🏆', className: 'victory' };
            case 'teamB':
                return { text: 'Defeat', emoji: '💔', className: 'defeat' };
            default:
                return { text: 'Draw', emoji: '🤝', className: 'draw' };
        }
    };

    if (isLoading) {
        return (
            <div className="history-screen screen">
                <div className="screen-header">
                    <button className="btn btn-secondary" onClick={() => navigate('/')}>
                        ← Back
                    </button>
                    <h1 className="screen-title">Match History</h1>
                    <div style={{ width: 80 }}></div>
                </div>
                <p className="text-center">Loading...</p>
            </div>
        );
    }

    return (
        <div className="history-screen screen">
            <div className="screen-header">
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                    ← Back
                </button>
                <h1 className="screen-title">Match History</h1>
                <div style={{ width: 80 }}></div>
            </div>

            <div className="history-content">
                {matches.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📜</span>
                        <p>No matches yet!</p>
                        <button className="btn btn-primary" onClick={() => navigate('/pre-match')}>
                            Play Your First Match
                        </button>
                    </div>
                ) : (
                    <div className="matches-list">
                        {matches.map((match) => {
                            const resultInfo = getResultDisplay(match.result);
                            return (
                                <div key={match.matchId} className={`match-entry ${resultInfo.className}`}>
                                    <div className="match-result">
                                        <span className="result-emoji">{resultInfo.emoji}</span>
                                        <span className="result-text">{resultInfo.text}</span>
                                    </div>
                                    <div className="match-details">
                                        <span className="match-opponent">vs {match.opponentType.toUpperCase()}</span>
                                        <span className="match-turns">{match.totalTurns} turns</span>
                                    </div>
                                    <div className="match-meta">
                                        <span className="match-xp">+{match.xpGained} XP</span>
                                        <span className="match-date">{formatDate(match.createdAt)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="history-stats">
                <div className="stat-card">
                    <span className="stat-value">{matches.length}</span>
                    <span className="stat-label">Total Matches</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{matches.filter((m) => m.result === 'teamA').length}</span>
                    <span className="stat-label">Victories</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">
                        {matches.length > 0
                            ? Math.round((matches.filter((m) => m.result === 'teamA').length / matches.length) * 100)
                            : 0}%
                    </span>
                    <span className="stat-label">Win Rate</span>
                </div>
            </div>
        </div>
    );
}

export default HistoryScreen;
