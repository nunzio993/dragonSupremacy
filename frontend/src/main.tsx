import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { GameDataProvider } from './contexts/GameDataContext';
import { WalletProvider } from './contexts/WalletContext';
import { wagmiConfig } from './config/wagmi';
import './styles/index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <WalletProvider>
                        <AuthProvider>
                            <GameDataProvider>
                                <App />
                            </GameDataProvider>
                        </AuthProvider>
                    </WalletProvider>
                </BrowserRouter>
            </QueryClientProvider>
        </WagmiProvider>
    </React.StrictMode>
);

