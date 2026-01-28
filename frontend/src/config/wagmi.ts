/**
 * Wagmi Configuration for Base Sepolia + Hardhat Local
 */

import { http, createConfig } from 'wagmi';
import { baseSepolia, base, hardhat } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Contract addresses
export const CONTRACT_ADDRESSES = {
    hardhat: {
        creatureNFT: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', // RMRKCreature on local
        battleArena: '0x0000000000000000000000000000000000000000',
    },
    baseSepolia: {
        creatureNFT: '0xa97cc4df48b66Ad448dF1cb768B09391c467f9c8',
        battleArena: '0x46Cb0D2cD0671Aa742C728D696144E58A7605eA7',
    },
    base: {
        creatureNFT: '0x0000000000000000000000000000000000000000', // TBD
        battleArena: '0x0000000000000000000000000000000000000000', // TBD
    }
};

// Determine which chain to use based on environment
const isDevelopment = import.meta.env.DEV;

export const wagmiConfig = createConfig({
    chains: [hardhat, baseSepolia, base],
    connectors: [
        injected(),  // Works with MetaMask and other injected wallets
    ],
    transports: {
        [hardhat.id]: http('http://127.0.0.1:8545'),
        [baseSepolia.id]: http('https://sepolia.base.org'),
        [base.id]: http('https://mainnet.base.org'),
    },
});

// Get contract addresses for current chain
export function getContractAddresses(chainId: number) {
    if (chainId === hardhat.id) {
        return CONTRACT_ADDRESSES.hardhat;
    }
    if (chainId === baseSepolia.id) {
        return CONTRACT_ADDRESSES.baseSepolia;
    }
    return CONTRACT_ADDRESSES.base;
}

// Default chain for development
export const defaultChain = isDevelopment ? hardhat : base;

// Chain IDs
export const CHAIN_IDS = {
    HARDHAT: hardhat.id,
    BASE_SEPOLIA: baseSepolia.id,
    BASE: base.id,
};
