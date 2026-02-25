
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Client, Vehicle, BankCredential } from '../types';
import { clientService, vehicleService, credentialsService } from '../services/api';

export interface AppContextType {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    vehicles: Vehicle[];
    setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
    bankCredentials: BankCredential[];
    updateBankCredential: (data: BankCredential) => void;
    updateClientScore: (clientId: string, newScore: number) => void;
    refreshData: () => Promise<void>;
    simulationState: any;
    setSimulationState: React.Dispatch<React.SetStateAction<any>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [bankCredentials, setBankCredentials] = useState<BankCredential[]>([]);

    const refreshData = async () => {
        try {
            const [clientsData, vehiclesData, credentialsData] = await Promise.all([
                clientService.getAll(),
                vehicleService.getAll(),
                credentialsService.getAll()
            ]);
            setClients(clientsData);
            setVehicles(vehiclesData);
            setBankCredentials(credentialsData);
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    const updateBankCredential = (data: BankCredential) => {
        setBankCredentials(prev => {
            const exists = prev.find(c => c.bankId === data.bankId);
            if (exists) {
                return prev.map(c => c.bankId === data.bankId ? data : c);
            }
            return [...prev, data];
        });
    };

    const updateClientScore = (clientId: string, newScore: number) => {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, score: newScore } : c));
    };

    const [simulationState, setSimulationState] = useState<any>(null);

    return (
        <AppContext.Provider value={{
            clients, setClients,
            vehicles, setVehicles,
            bankCredentials, updateBankCredential,
            updateClientScore,
            refreshData,
            simulationState, setSimulationState
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
