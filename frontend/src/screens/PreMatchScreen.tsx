import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import { useTurnBattle } from '../contexts/TurnBattleContext';
import api from '../services/api';
import turnBattleApi from '../services/turnBattleApi';
import UnitCard from '../components/UnitCard';
import './PreMatchScreen.css';

interface RosterUnit {
    instanceId: string;
    unitDefinitionId: string;
    equippedItems: string[];
}

function PreMatchScreen() {
    const navigate = useNavigate();
    const { getUnit } = useGameData();
    const { initBattle } = useTurnBattle();
    const [units, setUnits] = useState<RosterUnit[]>([]);
    const [loadout, setLoadout] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isStartingTurnBattle, setIsStartingTurnBattle] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadRoster();
    }, []);

    const loadRoster = async () => {
        try {
            const data = await api.getRoster();
            setUnits(data.units);
            setLoadout(data.loadout);
        } catch (error) {
            console.error('Failed to load roster:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleUnit = async (instanceId: string) => {
        let newLoadout: string[];

        if (loadout.includes(instanceId)) {
            newLoadout = loadout.filter((id) => id !== instanceId);
        } else if (loadout.length < 3) {
            newLoadout = [...loadout, instanceId];
        } else {
            return; // Max 3 units
        }

        setIsSaving(true);
        try {
            await api.saveLoadout(newLoadout);
            setLoadout(newLoadout);
        } catch (error) {
            console.error('Failed to save loadout:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const startAutoBattle = () => {
        if (loadout.length === 0) return;
        navigate('/match');
    };

    const startTurnBattle = async () => {
        if (loadout.length !== 3) return;

        setIsStartingTurnBattle(true);
        try {
            const response = await turnBattleApi.startBattle(loadout, 'easy');
            initBattle(response.matchId, response.state);
            navigate('/turn-battle');
        } catch (error) {
            console.error('Failed to start turn battle:', error);
            alert('Failed to start battle. Please try again.');
        } finally {
            setIsStartingTurnBattle(false);
        }
    };

    if (isLoading) {
        return (
            <div className="prematch-screen screen">
                <p className="text-center">Loading...</p>
            </div>
        );
    }

    return (
        <div className="prematch-screen screen">
            <div className="screen-header">
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                    ← Back
                </button>
                <h1 className="screen-title">Select Your Team</h1>
                <div style={{ width: 80 }}></div>
            </div>

            <div className="prematch-content">
                <div className="loadout-preview">
                    <h2>Your Team ({loadout.length}/3)</h2>
                    <div className="loadout-slots">
                        {[0, 1, 2].map((index) => {
                            const unitId = loadout[index];
                            const unit = units.find((u) => u.instanceId === unitId);
                            const def = unit ? getUnit(unit.unitDefinitionId) : null;

                            return (
                                <div key={index} className={`loadout-slot ${def ? 'filled' : 'empty'}`}>
                                    {def ? (
                                        <div onClick={() => toggleUnit(unitId)}>
                                            <UnitCard unit={def} compact />
                                            <span className="remove-hint">Click to remove</span>
                                        </div>
                                    ) : (
                                        <div className="slot-placeholder">
                                            <span>Slot {index + 1}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="unit-selection">
                    <h2>Available Units</h2>
                    <div className="unit-grid">
                        {units
                            .filter((u) => !loadout.includes(u.instanceId))
                            .map((unit) => {
                                const def = getUnit(unit.unitDefinitionId);
                                if (!def) return null;

                                return (
                                    <div
                                        key={unit.instanceId}
                                        className="selectable-unit"
                                        onClick={() => toggleUnit(unit.instanceId)}
                                    >
                                        <UnitCard unit={def} />
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            <div className="prematch-footer">
                <button
                    className="btn btn-secondary btn-large"
                    onClick={startAutoBattle}
                    disabled={loadout.length === 0 || isSaving}
                >
                    ⚡ Auto Battle (Legacy)
                </button>
                <button
                    className="btn btn-primary btn-large"
                    onClick={startTurnBattle}
                    disabled={loadout.length !== 3 || isSaving || isStartingTurnBattle}
                >
                    {isStartingTurnBattle ? '⏳ Starting...' : '🎮 Turn-Based Battle'}
                </button>
            </div>
        </div>
    );
}

export default PreMatchScreen;

