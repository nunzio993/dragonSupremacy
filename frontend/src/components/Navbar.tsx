/**
 * Navbar Component
 *
 * Displays navigation links, token balances, and wallet status at the top of the app.
 */

import { NavLink } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useBattleEntry } from '../hooks/useBattleGate';
import { formatEther } from 'viem';
import { CONTRACTS } from '../contracts/config';
import './Navbar.css';

// AirdropVault ABI for locked balance
const AIRDROP_VAULT_ABI = [
    {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getLockedBalance',
        outputs: [{ name: 'balance', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

function Navbar() {
    const { address, isConnected } = useAccount();
    const { connect } = useConnect();
    const { disconnect } = useDisconnect();

    // Get token balances from BattleGate hook
    const { dgneBalance } = useBattleEntry();

    // Get locked balance from AirdropVault
    const isVaultDeployed = CONTRACTS.AIRDROP_VAULT !== '0x0000000000000000000000000000000000000000';
    const { data: lockedBalance } = useReadContract({
        address: CONTRACTS.AIRDROP_VAULT,
        abi: AIRDROP_VAULT_ABI,
        functionName: 'getLockedBalance',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && isVaultDeployed && !!address },
    });

    // Total balance = wallet DGNE + locked DGNE
    const totalBalance = dgneBalance + (lockedBalance ?? 0n);

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
                <NavLink to="/tokenomics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    📊 Tokenomics
                </NavLink>
                <NavLink to="/airdrop" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    🪂 Airdrop
                </NavLink>
                <NavLink to="/guide" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    📖 Guide
                </NavLink>
            </div>

            <div className="navbar-stats">
                {isConnected ? (
                    <>
                        <div className="stat-item dgne" title={`Wallet: ${formatBalance(dgneBalance)} + Locked: ${formatBalance(lockedBalance ?? 0n)}`}>
                            {formatBalance(totalBalance)} DGNE
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

