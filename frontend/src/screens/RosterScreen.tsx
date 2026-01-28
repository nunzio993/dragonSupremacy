import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import api from '../services/api';
import UnitCard from '../components/UnitCard';
import './RosterScreen.css';

interface RosterUnit {
    instanceId: string;
    unitDefinitionId: string;
    equippedItems: string[];
}

interface RosterEquipment {
    instanceId: string;
    equipmentDefinitionId: string;
}

function RosterScreen() {
    const navigate = useNavigate();
    const { getUnit, getEquipment } = useGameData();
    const [units, setUnits] = useState<RosterUnit[]>([]);
    const [equipment, setEquipment] = useState<RosterEquipment[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<RosterUnit | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadRoster();
    }, []);

    const loadRoster = async () => {
        try {
            const data = await api.getRoster();
            setUnits(data.units);
            setEquipment(data.equipment);
        } catch (error) {
            console.error('Failed to load roster:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEquip = async (equipInstanceId: string) => {
        if (!selectedUnit) return;

        try {
            await api.equipItem(selectedUnit.instanceId, equipInstanceId);
            await loadRoster();
            setSelectedUnit(null);
        } catch (error) {
            console.error('Failed to equip item:', error);
        }
    };

    const handleUnequip = async (equipInstanceId: string) => {
        try {
            await api.unequipItem(equipInstanceId);
            await loadRoster();
        } catch (error) {
            console.error('Failed to unequip item:', error);
        }
    };

    const getAvailableEquipment = () => {
        const equippedIds = new Set(units.flatMap((u) => u.equippedItems));
        return equipment.filter((e) => !equippedIds.has(e.instanceId));
    };

    if (isLoading) {
        return (
            <div className="roster-screen screen">
                <p className="text-center">Loading roster...</p>
            </div>
        );
    }

    return (
        <div className="roster-screen screen">
            <div className="screen-header">
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                    ← Back
                </button>
                <h1 className="screen-title">Your Roster</h1>
                <div style={{ width: 80 }}></div>
            </div>

            <div className="roster-content">
                <section className="roster-section">
                    <h2>Units ({units.length})</h2>
                    <div className="unit-grid">
                        {units.map((unit) => {
                            const def = getUnit(unit.unitDefinitionId);
                            if (!def) return null;

                            return (
                                <div
                                    key={unit.instanceId}
                                    className={`unit-card-wrapper ${selectedUnit?.instanceId === unit.instanceId ? 'selected' : ''}`}
                                    onClick={() => setSelectedUnit(unit)}
                                >
                                    <UnitCard unit={def} />
                                    {unit.equippedItems.length > 0 && (
                                        <div className="equipped-badges">
                                            {unit.equippedItems.map((equipId) => {
                                                const eq = equipment.find((e) => e.instanceId === equipId);
                                                const eqDef = eq ? getEquipment(eq.equipmentDefinitionId) : null;
                                                return eqDef ? (
                                                    <span
                                                        key={equipId}
                                                        className="equip-badge"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleUnequip(equipId);
                                                        }}
                                                        title={`${eqDef.name} - Click to unequip`}
                                                    >
                                                        {eqDef.type === 'weapon' ? '⚔️' : eqDef.type === 'armor' ? '🛡️' : '💎'}
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {selectedUnit && (
                    <section className="roster-section equip-panel">
                        <h2>
                            Equip to: {getUnit(selectedUnit.unitDefinitionId)?.name}
                            <button
                                className="btn btn-secondary"
                                style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
                                onClick={() => setSelectedUnit(null)}
                            >
                                Cancel
                            </button>
                        </h2>
                        {selectedUnit.equippedItems.length >= 2 ? (
                            <p className="text-muted">Unit has max equipment (2). Unequip first.</p>
                        ) : (
                            <div className="equipment-grid">
                                {getAvailableEquipment().map((eq) => {
                                    const def = getEquipment(eq.equipmentDefinitionId);
                                    if (!def) return null;

                                    return (
                                        <div
                                            key={eq.instanceId}
                                            className="equipment-card"
                                            onClick={() => handleEquip(eq.instanceId)}
                                        >
                                            <span className="equip-type-icon">
                                                {def.type === 'weapon' ? '⚔️' : def.type === 'armor' ? '🛡️' : '💎'}
                                            </span>
                                            <span className="equip-name">{def.name}</span>
                                            <div className="equip-stats">
                                                {def.bonusHp !== 0 && <span>HP {def.bonusHp > 0 ? '+' : ''}{def.bonusHp}</span>}
                                                {def.bonusAtk !== 0 && <span>ATK {def.bonusAtk > 0 ? '+' : ''}{def.bonusAtk}</span>}
                                                {def.bonusSpd !== 0 && <span>SPD {def.bonusSpd > 0 ? '+' : ''}{def.bonusSpd}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}

export default RosterScreen;
