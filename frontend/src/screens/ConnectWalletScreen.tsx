/**
 * Connect Wallet Screen
 * 
 * Shown when user has not connected their wallet.
 * Forces wallet connection to use the app.
 */

import { useWallet } from '../contexts/WalletContext';
import './ConnectWalletScreen.css';

export default function ConnectWalletScreen() {
    const { connect, isConnecting, isConnected, chainId, isCorrectChain, switchToBaseSepolia } = useWallet();

    const handleConnect = async () => {
        try {
            await connect();
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    };

    const handleSwitchChain = async () => {
        try {
            await switchToBaseSepolia();
        } catch (error) {
            console.error('Failed to switch chain:', error);
        }
    };

    // If connected but wrong chain, show switch chain UI
    if (isConnected && !isCorrectChain) {
        return (
            <div className="connect-wallet-screen">
                <div className="connect-wallet-card">
                    <div className="dragon-logo">🐉</div>
                    <h1>Wrong Network</h1>
                    <p className="subtitle">
                        Please switch to Hardhat (localhost) or Base Sepolia to continue.
                    </p>
                    <p className="current-chain">
                        Current Chain ID: {chainId}
                    </p>
                    <button
                        className="connect-button switch-chain"
                        onClick={handleSwitchChain}
                    >
                        Switch to Base Sepolia
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="connect-wallet-screen">
            <div className="connect-wallet-card">
                <div className="dragon-logo">🐉</div>
                <h1>Dragon Autobattler</h1>
                <p className="subtitle">
                    Connect your wallet to start playing
                </p>
                <p className="description">
                    Battle with your dragons on Base blockchain.
                    Stake DGNE tokens, win battles, earn rewards.
                </p>
                <button
                    className="connect-button"
                    onClick={handleConnect}
                    disabled={isConnecting}
                >
                    {isConnecting ? 'Connecting...' : '🦊 Connect with MetaMask'}
                </button>
                <p className="network-info">
                    Supported networks: Base Sepolia, Hardhat Local
                </p>
            </div>
        </div>
    );
}
