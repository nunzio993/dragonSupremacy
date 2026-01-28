import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { UnitDefinition, EquipmentDefinition } from '@nft-autobattler/shared-types';

interface GameDataContextType {
    units: UnitDefinition[];
    equipment: EquipmentDefinition[];
    isLoading: boolean;
    getUnit: (id: string) => UnitDefinition | undefined;
    getEquipment: (id: string) => EquipmentDefinition | undefined;
}

const GameDataContext = createContext<GameDataContextType | null>(null);

export function GameDataProvider({ children }: { children: ReactNode }) {
    const [units, setUnits] = useState<UnitDefinition[]>([]);
    const [equipment, setEquipment] = useState<EquipmentDefinition[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadGameData();
    }, []);

    const loadGameData = async () => {
        try {
            const data = await api.getGameData();
            setUnits(data.units);
            setEquipment(data.equipment);
        } catch (error) {
            console.error('Failed to load game data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getUnit = (id: string) => units.find((u) => u.id === id);
    const getEquipment = (id: string) => equipment.find((e) => e.id === id);

    return (
        <GameDataContext.Provider
            value={{
                units,
                equipment,
                isLoading,
                getUnit,
                getEquipment,
            }}
        >
            {children}
        </GameDataContext.Provider>
    );
}

export function useGameData() {
    const context = useContext(GameDataContext);
    if (!context) {
        throw new Error('useGameData must be used within GameDataProvider');
    }
    return context;
}
