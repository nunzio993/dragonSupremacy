/**
 * Connect Wallet Button Component
 */

import { useWallet } from '../../contexts/WalletContext';
import './ConnectWallet.css';

export function ConnectWallet() {
    const {
        isConnected,
        isConnecting,
        connect,
        disconnect,
        shortAddress,
        isCorrectChain,
        switchToBaseSepolia
    } = useWallet();

    if (isConnecting) {
        return (
            <button className="connect-wallet connecting" disabled>
                <span className="spinner"></span>
                Connecting...
            </button>
        );
    }

    if (isConnected) {
        if (!isCorrectChain) {
            return (
                <button
                    className="connect-wallet wrong-chain"
                    onClick={switchToBaseSepolia}
                >
                    ⚠️ Switch to Base Sepolia
                </button>
            );
        }

        return (
            <div className="wallet-connected">
                <span className="wallet-address">{shortAddress}</span>
                <button className="disconnect-btn" onClick={disconnect}>
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button className="connect-wallet" onClick={connect}>
            🦊 Connect Wallet
        </button>
    );
}
