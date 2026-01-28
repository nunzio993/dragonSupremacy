import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '../contracts/config';
import './AdminScreen.css';

// ABI for GameConfig admin functions
const GAME_CONFIG_ABI = [
    // View functions
    { name: 'battleCostDGNE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'battleRewardDGNE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'mintCostDGNE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'skipCostDGNE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'stakingBaseRate', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'talentMultiplier', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'healCostPerHP', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'regenPercentPerHour', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    // Setter functions (with correct signatures)
    {
        name: 'setBattleCosts', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: '_dgne', type: 'uint256' }, { name: '_rmrk', type: 'uint256' }, { name: '_reward', type: 'uint256' }], outputs: []
    },
    {
        name: 'setMintCosts', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: '_mintCost', type: 'uint256' }, { name: '_skipCost', type: 'uint256' }, { name: '_rmrk', type: 'uint256' }], outputs: []
    },
    {
        name: 'setStakingParams', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: '_baseRate', type: 'uint256' }, { name: '_multiplier', type: 'uint256' }], outputs: []
    },
    {
        name: 'setHealingParams', type: 'function', stateMutability: 'nonpayable',
        inputs: [{ name: '_costPerHP', type: 'uint256' }, { name: '_regenPercent', type: 'uint256' }], outputs: []
    },
] as const;

const formatEther = (wei: bigint | undefined) => wei ? (Number(wei) / 1e18).toFixed(2) : '0';

export function AdminScreen() {
    const { address, isConnected } = useAccount();

    // Local state for form inputs
    const [battleCost, setBattleCost] = useState('5');
    const [mintCost, setMintCost] = useState('10');
    const [skipCost, setSkipCost] = useState('1');
    const [stakingRate, setStakingRate] = useState('10');
    const [talentMult, setTalentMult] = useState('100');
    const [healCost, setHealCost] = useState('0.1');
    const [regenPercent, setRegenPercent] = useState('5');

    const { writeContract, data: txHash, isPending, reset } = useWriteContract();
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

    // Read current values
    const { data: currentBattleCost, refetch: refetchBattle } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'battleCostDGNE',
    });
    const { data: currentMintCost, refetch: refetchMint } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'mintCostDGNE',
    });
    const { data: currentSkipCost } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'skipCostDGNE',
    });
    const { data: currentStakingRate, refetch: refetchStaking } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'stakingBaseRate',
    });
    const { data: currentTalentMult } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'talentMultiplier',
    });
    const { data: currentHealCost, refetch: refetchHealing } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'healCostPerHP',
    });
    const { data: currentRegenPercent } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'regenPercentPerHour',
    });
    const { data: contractOwner } = useReadContract({
        address: CONTRACTS.GAME_CONFIG,
        abi: GAME_CONFIG_ABI,
        functionName: 'owner',
    });

    const isOwner = address && contractOwner && address.toLowerCase() === contractOwner.toLowerCase();

    // Refetch after success
    useEffect(() => {
        if (isSuccess) {
            setTimeout(() => {
                refetchBattle();
                refetchMint();
                refetchStaking();
                refetchHealing();
                reset();
            }, 1000);
        }
    }, [isSuccess, refetchBattle, refetchMint, refetchStaking, refetchHealing, reset]);

    const handleUpdateBattle = () => {
        writeContract({
            address: CONTRACTS.GAME_CONFIG,
            abi: GAME_CONFIG_ABI,
            functionName: 'setBattleCosts',
            args: [
                BigInt(Math.floor(parseFloat(battleCost) * 1e18)),
                0n, // RMRK cost (deprecated, set to 0)
                BigInt(Math.floor(parseFloat(battleReward) * 1e18)),
            ]
        });
    };

    const handleUpdateMint = () => {
        writeContract({
            address: CONTRACTS.GAME_CONFIG,
            abi: GAME_CONFIG_ABI,
            functionName: 'setMintCosts',
            args: [
                BigInt(Math.floor(parseFloat(mintCost) * 1e18)),
                BigInt(Math.floor(parseFloat(skipCost) * 1e18)),
                0n, // RMRK cost (deprecated)
            ]
        });
    };

    const handleUpdateStaking = () => {
        writeContract({
            address: CONTRACTS.GAME_CONFIG,
            abi: GAME_CONFIG_ABI,
            functionName: 'setStakingParams',
            args: [
                BigInt(Math.floor(parseFloat(stakingRate) * 1e18)),
                BigInt(talentMult)
            ]
        });
    };

    const handleUpdateHealing = () => {
        writeContract({
            address: CONTRACTS.GAME_CONFIG,
            abi: GAME_CONFIG_ABI,
            functionName: 'setHealingParams',
            args: [
                BigInt(Math.floor(parseFloat(healCost) * 1e18)),
                BigInt(regenPercent)
            ]
        });
    };

    if (!isConnected) {
        return (
            <div className="admin-screen">
                <div className="admin-container">
                    <h1>⚙️ Admin Panel</h1>
                    <p className="connect-message">Connect your wallet to access admin panel</p>
                </div>
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className="admin-screen">
                <div className="admin-container">
                    <h1>⚙️ Admin Panel</h1>
                    <div className="access-denied">
                        <h2>🚫 Access Denied</h2>
                        <p>Only the contract owner can access this panel.</p>
                        <p className="owner-info">Owner: {contractOwner}</p>
                    </div>
                </div>
            </div>
        );
    }

    const processing = isPending || isConfirming;

    return (
        <div className="admin-screen">
            <div className="admin-container">
                <h1>⚙️ Admin Panel</h1>

                {isSuccess && <div className="success-toast">✅ Transaction confirmed!</div>}

                {/* Battle Minimum Bet */}
                <div className="config-section">
                    <h2>⚔️ Battle Settings</h2>
                    <div className="current-values">
                        Current minimum bet: {formatEther(currentBattleCost)} DGNE
                    </div>
                    <div className="config-row">
                        <div className="config-input">
                            <label>Minimum Bet (DGNE)</label>
                            <input
                                type="number"
                                value={battleCost}
                                onChange={(e) => setBattleCost(e.target.value)}
                                disabled={processing}
                            />
                        </div>
                        <button onClick={handleUpdateBattle} disabled={processing}>
                            {processing ? 'Updating...' : 'Update'}
                        </button>
                    </div>
                    <p className="formula-info">Players choose their bet amount, this is the minimum required</p>
                </div>

                {/* Mint Costs */}
                <div className="config-section">
                    <h2>🥚 Mint Costs</h2>
                    <div className="current-values">
                        Current: {formatEther(currentMintCost)} DGNE mint, {formatEther(currentSkipCost)} DGNE skip
                    </div>
                    <div className="config-row">
                        <div className="config-input">
                            <label>Mint Cost (DGNE)</label>
                            <input
                                type="number"
                                value={mintCost}
                                onChange={(e) => setMintCost(e.target.value)}
                                disabled={processing}
                            />
                        </div>
                        <div className="config-input">
                            <label>Skip Cost (DGNE)</label>
                            <input
                                type="number"
                                value={skipCost}
                                onChange={(e) => setSkipCost(e.target.value)}
                                disabled={processing}
                            />
                        </div>
                        <button onClick={handleUpdateMint} disabled={processing}>
                            {processing ? 'Updating...' : 'Update'}
                        </button>
                    </div>
                </div>

                {/* Staking */}
                <div className="config-section">
                    <h2>💰 Staking Rate</h2>
                    <div className="current-values">
                        Current: {formatEther(currentStakingRate)} DGNE/day base rate, talent multiplier: {currentTalentMult?.toString() || '100'}
                    </div>
                    <div className="config-row">
                        <div className="config-input">
                            <label>Base Rate (DGNE/day)</label>
                            <input
                                type="number"
                                value={stakingRate}
                                onChange={(e) => setStakingRate(e.target.value)}
                                disabled={processing}
                            />
                        </div>
                        <div className="config-input">
                            <label>Talent Multiplier</label>
                            <input
                                type="number"
                                value={talentMult}
                                onChange={(e) => setTalentMult(e.target.value)}
                                disabled={processing}
                            />
                        </div>
                        <button onClick={handleUpdateStaking} disabled={processing}>
                            {processing ? 'Updating...' : 'Update'}
                        </button>
                    </div>
                    <p className="formula-info">Formula: Rate = baseRate × (1 + talent/multiplier)</p>
                </div>

                {/* Healing */}
                <div className="config-section">
                    <h2>💊 Healing Parameters</h2>
                    <div className="current-values">
                        Current: {formatEther(currentHealCost)} DGNE/HP, {currentRegenPercent?.toString() || '5'}% regen/hour
                    </div>
                    <div className="config-row">
                        <div className="config-input">
                            <label>Cost per HP (DGNE)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={healCost}
                                onChange={(e) => setHealCost(e.target.value)}
                                disabled={processing}
                            />
                        </div>
                        <div className="config-input">
                            <label>Regen % per Hour</label>
                            <input
                                type="number"
                                value={regenPercent}
                                onChange={(e) => setRegenPercent(e.target.value)}
                                disabled={processing}
                            />
                        </div>
                        <button onClick={handleUpdateHealing} disabled={processing}>
                            {processing ? 'Updating...' : 'Update'}
                        </button>
                    </div>
                </div>

                {/* Contract Info */}
                <div className="config-section">
                    <h2>📋 Contract Addresses</h2>
                    <div className="contract-info">
                        <p><strong>GameConfig:</strong> {CONTRACTS.GAME_CONFIG}</p>
                        <p><strong>DragonStaking:</strong> {CONTRACTS.DRAGON_STAKING}</p>
                        <p><strong>DragonToken:</strong> {CONTRACTS.DRAGON_TOKEN}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminScreen;
