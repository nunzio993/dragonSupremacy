/**
 * Navbar Component
 *
 * Displays navigation links, token balances, and wallet status at the top of the app.
 */

import { NavLink } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useBattleEntry } from '../hooks/useBattleGate';
import { formatEther } from 'viem';
import './Navbar.css';

function Navbar() {
    const { address, isConnected } = useAccount();
    const { connect } = useConnect();
    const { disconnect } = useDisconnect();

    // Get token balances from BattleGate hook
    const { dgneBalance } = useBattleEntry();

    // Format balance for display - full integer numbers
    const formatBalance = (balance: bigint) => {
        const num = parseFloat(formatEther(balance));
        return Math.floor(num).toString();
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <NavLink to="/" className="brand-link">
                    <span className="brand-icon">🐉</span>
                    <span className="brand-text">Dragon Supremacy</span>
                </NavLink>
            </div>

            <div className="navbar-links">
                <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    🏠 Home
                </NavLink>
                <NavLink to="/creatures" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    🐉 My Dragons
                </NavLink>
                <NavLink to="/mint" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    🥚 Hatch
                </NavLink>
                <NavLink to="/lobby" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    ⚔️ Battle
                </NavLink>
                <NavLink to="/staking" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    💎 Staking
                </NavLink>
                <NavLink to="/guide" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    📖 Guide
                </NavLink>
            </div>

            <div className="navbar-stats">
                {isConnected ? (
                    <>
                        <div className="stat-item dgne" title="DGNE Balance">
                            {formatBalance(dgneBalance)} DGNE
                        </div>
                        <button
                            className="wallet-badge connected"
                            onClick={() => disconnect()}
                            title="Click to disconnect"
                        >
                            <span className="wallet-address">
                                {address?.slice(0, 6)}...{address?.slice(-4)}
                            </span>
                        </button>
                    </>
                ) : (
                    <button
                        className="wallet-badge disconnected"
                        onClick={() => connect({ connector: injected() })}
                    >
                        🔗 Connect
                    </button>
                )}
            </div>
        </nav>
    );
}

export default Navbar;

