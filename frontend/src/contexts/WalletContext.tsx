/**
 * Wallet Context
 * Provides wallet connection state across the app
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { metaMask } from 'wagmi/connectors';
import { CHAIN_IDS } from '../config/wagmi';

interface WalletContextType {
    // Connection state
    address: string | undefined;
    isConnected: boolean;
    isConnecting: boolean;

    // Chain state
    chainId: number | undefined;
    isCorrectChain: boolean;

    // Actions
    connect: () => Promise<void>;
    disconnect: () => void;
    switchToBaseSepolia: () => Promise<void>;

    // Formatted address (0x1234...5678)
    shortAddress: string;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
    const { address, isConnected, isConnecting } = useAccount();
    const { connectAsync } = useConnect();
    const { disconnect: wagmiDisconnect } = useDisconnect();
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();

    const [isCorrectChain, setIsCorrectChain] = useState(false);

    // Check if on correct chain (accept Hardhat for local dev or Base Sepolia for testnet)
    useEffect(() => {
        if (chainId) {
            const isValid = chainId === CHAIN_IDS.HARDHAT || chainId === CHAIN_IDS.BASE_SEPOLIA;
            setIsCorrectChain(isValid);
        }
    }, [chainId]);

    // Connect wallet
    const connect = async () => {
        try {
            await connectAsync({ connector: metaMask() });
        } catch (error) {
            console.error('Failed to connect:', error);
            throw error;
        }
    };

    // Disconnect wallet
    const disconnect = () => {
        wagmiDisconnect();
    };

    // Switch to Base Sepolia
    const switchToBaseSepolia = async () => {
        try {
            await switchChainAsync({ chainId: CHAIN_IDS.BASE_SEPOLIA });
        } catch (error) {
            console.error('Failed to switch chain:', error);
            throw error;
        }
    };

    // Format address
    const shortAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : '';

    const value: WalletContextType = {
        address,
        isConnected,
        isConnecting,
        chainId,
        isCorrectChain,
        connect,
        disconnect,
        switchToBaseSepolia,
        shortAddress,
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet(): WalletContextType {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within WalletProvider');
    }
    return context;
}
