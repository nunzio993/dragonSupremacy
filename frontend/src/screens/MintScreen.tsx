import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { useCreatureBalance } from '../hooks/useCreatureContract';
import { CONTRACTS } from '../contracts/config';
import { parseEther, formatEther, Address, maxUint256, keccak256, toHex } from 'viem';
import './MintScreen.css';

// COSTS - should match GameConfig on-chain values
const MINT_COST = parseEther('10');
const SKIP_COST = parseEther('1');

// Element types
const ELEMENT_TYPES = [
    { id: 'FIRE', name: 'Fire', emoji: '🔥', color: '#e74c3c' },
    { id: 'WATER', name: 'Water', emoji: '💧', color: '#3498db' },
    { id: 'GRASS', name: 'Grass', emoji: '🌿', color: '#27ae60' },
    { id: 'ELECTRIC', name: 'Electric', emoji: '⚡', color: '#f1c40f' },
    { id: 'ICE', name: 'Ice', emoji: '❄️', color: '#00bcd4' },
    { id: 'EARTH', name: 'Earth', emoji: '🪨', color: '#8b4513' },
    { id: 'DARK', name: 'Dark', emoji: '🌑', color: '#2c3e50' },
    { id: 'LIGHT', name: 'Light', emoji: '✨', color: '#f39c12' },
] as const;

const PERSONALITIES = ['BRAVE', 'CALM', 'BOLD', 'TIMID', 'MODEST', 'ADAMANT', 'JOLLY', 'NEUTRAL'];
const TEMPERAMENTS = ['CALM', 'FOCUSED', 'NEUTRAL', 'NERVOUS', 'RECKLESS'];
const STAT_NAMES = ['STR', 'AGI', 'SPD', 'REF', 'END', 'VIT'] as const;

// ERC20 ABI
const ERC20_ABI = [
    { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
    { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

// MintGateV2 ABI - with signature verification
const MINT_GATE_ABI = [
    {
        name: 'mintCreature',
        type: 'function',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'genSeed', type: 'bytes32' },
            { name: 'talent', type: 'uint8' },
            { name: 'personality', type: 'bytes32' },
            { name: 'elementType', type: 'bytes32' },
            { name: 'temperament', type: 'bytes32' },
            { name: 'baseStats', type: 'uint72' },
            { name: 'growthRates', type: 'uint144' },
            {
                name: 'moves',
                type: 'tuple[4]',
                components: [
                    { name: 'moveId', type: 'uint8' },
                    { name: 'moveType', type: 'uint8' },
                    { name: 'category', type: 'uint8' },
                    { name: 'power', type: 'uint8' },
                    { name: 'accuracy', type: 'uint8' },
                    { name: 'cooldownMax', type: 'uint8' },
                    { name: 'statusEffect', type: 'uint8' },
                    { name: 'statusChance', type: 'uint8' },
                ]
            },
            { name: 'moveCount', type: 'uint8' },
            { name: 'mastery', type: 'uint8[4]' },
            { name: 'aptitudes', type: 'uint64' },
            { name: 'deadline', type: 'uint256' },
            { name: 'signature', type: 'bytes' },
        ],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'nonpayable'
    },
    { name: 'skipPreview', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' },
    { name: 'nonces', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { name: 'getSkipCount', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

// Seeded RNG for preview
function seededRandom(seed: string): () => number {
    let state = parseInt(seed.slice(2, 10), 16) || 1;
    return () => {
        let x = state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        state = x >>> 0;
        return (x >>> 0) / 0xFFFFFFFF;
    };
}

interface PreviewCreature {
    seed: `0x${string}`;
    elementType: typeof ELEMENT_TYPES[number];
    talent: number;
    personality: string;
    temperament: string;
    stats: Record<string, number>;
    visibleStatIndices: number[];
    showPersonality: boolean;
}

function generateCreatureFromSeed(seedInput: string): PreviewCreature {
    // Use keccak256 for proper cryptographic hashing
    const seed = keccak256(toHex(seedInput)) as `0x${string}`;
    const rng = seededRandom(seed);

    const elementType = ELEMENT_TYPES[Math.floor(rng() * ELEMENT_TYPES.length)];
    const u1 = rng();
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const talent = Math.max(1, Math.min(100, Math.round(50 + z * 15)));
    const personality = PERSONALITIES[Math.floor(rng() * PERSONALITIES.length)];
    const temperament = TEMPERAMENTS[Math.floor(rng() * TEMPERAMENTS.length)];

    const b = (talent - 50) / 50;
    const stats: Record<string, number> = {};
    STAT_NAMES.forEach(stat => {
        stats[stat] = Math.round(50 + 15 * b + rng() * 20 - 10);
    });

    const firstStatIndex = Math.floor(rng() * STAT_NAMES.length);
    let secondStatIndex = Math.floor(rng() * (STAT_NAMES.length - 1));
    if (secondStatIndex >= firstStatIndex) secondStatIndex++;
    const visibleStatIndices = [firstStatIndex, secondStatIndex];
    const showPersonality = rng() > 0.5;

    return { seed, elementType, talent, personality, temperament, stats, visibleStatIndices, showPersonality };
}

export function MintScreen() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const [preview, setPreview] = useState<PreviewCreature | null>(null);
    const [txStatus, setTxStatus] = useState<'idle' | 'minting' | 'skipping'>('idle');
    const [mintSuccess, setMintSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { data: balance } = useCreatureBalance(address);
    const { writeContractAsync } = useWriteContract();

    // DGNE balance
    const { data: dgneBalance, refetch: refetchBalance } = useReadContract({
        address: CONTRACTS.DRAGON_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    // Locked balance from AirdropVault
    const isVaultDeployed = CONTRACTS.AIRDROP_VAULT !== '0x0000000000000000000000000000000000000000';
    const { data: lockedBalance } = useReadContract({
        address: CONTRACTS.AIRDROP_VAULT as Address,
        abi: [{
            inputs: [{ name: 'user', type: 'address' }],
            name: 'getLockedBalance',
            outputs: [{ name: 'balance', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
        }] as const,
        functionName: 'getLockedBalance',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && isVaultDeployed && !!address },
    });

    // Total balance = wallet + locked
    const totalBalance = (dgneBalance ?? 0n) + (lockedBalance ?? 0n);

    // Allowance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: CONTRACTS.DRAGON_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, CONTRACTS.MINT_GATE_V2 as Address] : undefined,
    });

    // Nonce for signature - fallback to 0 if contract doesn't support it
    const { data: nonce } = useReadContract({
        address: CONTRACTS.MINT_GATE_V2 as Address,
        abi: MINT_GATE_ABI,
        functionName: 'nonces',
        args: address ? [address] : undefined,
    });
    const effectiveNonce = nonce ?? 0n;

    // Skip count from on-chain - fallback to 0 if contract doesn't support it
    const { data: skipCount, refetch: refetchSkipCount } = useReadContract({
        address: CONTRACTS.MINT_GATE_V2 as Address,
        abi: MINT_GATE_ABI,
        functionName: 'getSkipCount',
        args: address ? [address] : undefined,
    });
    const effectiveSkipCount = skipCount ?? 0n;

    const hasApproval = allowance !== undefined && allowance >= MINT_COST;

    // Generate preview based on address + nonce + skipCount (all deterministic)
    useEffect(() => {
        if (address) {
            // Use separators to ensure different skipCounts produce very different seeds
            const seedInput = `${address}|n${effectiveNonce.toString()}|s${effectiveSkipCount.toString()}`;
            console.log('[Preview] Generating with:', { address, nonce: effectiveNonce.toString(), skipCount: effectiveSkipCount.toString(), seedInput });
            setPreview(generateCreatureFromSeed(seedInput));
        }
    }, [address, effectiveNonce, effectiveSkipCount]);

    // Handle skip
    const handleSkip = useCallback(async () => {
        if (!address || !publicClient) return;

        setTxStatus('skipping');
        setError(null);
        try {
            if (!hasApproval) {
                const approveTx = await writeContractAsync({
                    address: CONTRACTS.DRAGON_TOKEN as Address,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [CONTRACTS.MINT_GATE_V2 as Address, maxUint256],
                });
                await publicClient.waitForTransactionReceipt({ hash: approveTx });
            }

            const tx = await writeContractAsync({
                address: CONTRACTS.MINT_GATE_V2 as Address,
                abi: MINT_GATE_ABI,
                functionName: 'skipPreview',
                gas: 500000n, // Gas limit for skip
            });

            await publicClient.waitForTransactionReceipt({ hash: tx });
            console.log('[Skip] Transaction confirmed, refetching skipCount from chain');

            // Refetch on-chain skipCount to get new preview
            refetchSkipCount();
            refetchBalance();
            refetchAllowance();
        } catch (err: any) {
            console.error('Skip error:', err);
            setError(err.message?.slice(0, 100) || 'Skip failed');
        } finally {
            setTxStatus('idle');
        }
    }, [address, publicClient, writeContractAsync, refetchBalance, refetchAllowance, refetchSkipCount, hasApproval]);

    // Handle mint - gets signed data from backend
    const handleMint = useCallback(async () => {
        if (!preview || !address || !publicClient) return;

        setTxStatus('minting');
        setError(null);
        setMintSuccess(false);
        try {
            // Auto-approve if needed
            if (!hasApproval) {
                const approveTx = await writeContractAsync({
                    address: CONTRACTS.DRAGON_TOKEN as Address,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [CONTRACTS.MINT_GATE_V2 as Address, maxUint256],
                });
                await publicClient.waitForTransactionReceipt({ hash: approveTx });
            }

            // Get signed data from backend
            const response = await fetch('http://localhost:3001/api/v1/mint/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seed: preview.seed,
                    elementType: preview.elementType.id,
                    userAddress: address,
                    nonce: Number(effectiveNonce),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate signed creature data');
            }

            const data = await response.json();
            const packed = data.packed;

            // Call MintGateV2 with signed data
            const tx = await writeContractAsync({
                address: CONTRACTS.MINT_GATE_V2 as Address,
                abi: MINT_GATE_ABI,
                functionName: 'mintCreature',
                args: [
                    address,
                    packed.genSeed as `0x${string}`,
                    packed.talent,
                    packed.personality as `0x${string}`,
                    packed.elementType as `0x${string}`,
                    packed.temperament as `0x${string}`,
                    BigInt(packed.baseStats),
                    BigInt(packed.growthRates),
                    packed.moves.map((m: any) => ({
                        moveId: m.moveId,
                        moveType: m.moveType,
                        category: m.category,
                        power: m.power,
                        accuracy: m.accuracy,
                        cooldownMax: m.cooldownMax,
                        statusEffect: m.statusEffect,
                        statusChance: m.statusChance,
                    })) as any,
                    packed.moveCount,
                    packed.mastery as [number, number, number, number],
                    BigInt(packed.aptitudes),
                    BigInt(packed.deadline),
                    packed.signature as `0x${string}`,
                ],
                gas: 5000000n, // High gas limit for complex mint
            });

            await publicClient.waitForTransactionReceipt({ hash: tx });

            setMintSuccess(true);
            // Refetch on-chain state
            refetchSkipCount();
            refetchBalance();
            refetchAllowance();
        } catch (err: any) {
            console.error('Mint error:', err);
            setError(err.message?.slice(0, 100) || 'Mint failed');
        } finally {
            setTxStatus('idle');
        }
    }, [preview, address, publicClient, writeContractAsync, refetchBalance, refetchAllowance, refetchSkipCount, hasApproval, effectiveNonce]);

    // Use total balance (wallet + locked) for affordability check
    const canAffordMint = totalBalance >= MINT_COST;
    const canAffordSkip = totalBalance >= SKIP_COST;

    if (!isConnected) {
        return (
            <div className="mint-screen">
                <div className="mint-container">
                    <h1>🥚 Mint Creature</h1>
                    <p className="connect-prompt">Connect your wallet to mint a creature</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mint-screen">
            <div className="mint-container">
                <h1><span className="header-icon">🐉</span> <span className="header-text">Mystery Dragon Mint</span></h1>

                <div className="cost-info">
                    <div className="cost-item">
                        <span className="cost-label">Mint Cost:</span>
                        <span className="cost-value mint">{formatEther(MINT_COST)} DGNE</span>
                    </div>
                    <div className="cost-item">
                        <span className="cost-label">Skip Cost:</span>
                        <span className="cost-value skip">{formatEther(SKIP_COST)} DGNE</span>
                    </div>
                    <div className="cost-item">
                        <span className="cost-label">Your DGNE:</span>
                        <span className={`cost-value ${canAffordMint ? 'ok' : 'low'}`}>
                            {dgneBalance ? formatEther(dgneBalance) : '0'}
                        </span>
                    </div>
                </div>

                {balance !== undefined && (
                    <div className="balance-info">
                        You own <strong>{balance.toString()}</strong> creature{balance !== 1n ? 's' : ''}
                    </div>
                )}

                {mintSuccess && (
                    <div className="minted-banner">
                        ✅ Dragon minted successfully! Check your collection.
                    </div>
                )}

                {error && (
                    <div className="error-banner">
                        ❌ Error: {error}
                    </div>
                )}

                {preview && (
                    <div className="preview-section">
                        <h2>🎁 Mystery Dragon #{Number(skipCount ?? 0n) + 1}</h2>
                        <p className="mystery-hint">Only 2 stats and 1 trait revealed. Will you take the risk?</p>

                        <div className="preview-card mystery" style={{
                            '--element-color': preview.elementType.color
                        } as React.CSSProperties}>

                            <div className="preview-header">
                                <div className="element-badge">
                                    <span className="preview-element">{preview.elementType.emoji}</span>
                                    <span className="element-name">{preview.elementType.name}</span>
                                </div>
                                <span className="preview-talent mystery-value">
                                    Talent: <strong>???</strong>
                                </span>
                            </div>

                            <div className="preview-traits mystery">
                                <div className={`trait ${preview.showPersonality ? 'visible' : 'hidden'}`}>
                                    <span className="trait-label">Personality</span>
                                    <span className={`trait-value ${preview.showPersonality ? '' : 'mystery-value'}`}>
                                        {preview.showPersonality ? preview.personality : '???'}
                                    </span>
                                </div>
                                <div className={`trait ${!preview.showPersonality ? 'visible' : 'hidden'}`}>
                                    <span className="trait-label">Temperament</span>
                                    <span className={`trait-value ${!preview.showPersonality ? '' : 'mystery-value'}`}>
                                        {!preview.showPersonality ? preview.temperament : '???'}
                                    </span>
                                </div>
                            </div>

                            <div className="preview-stats mystery">
                                {STAT_NAMES.map((stat, index) => {
                                    const isVisible = preview.visibleStatIndices.includes(index);
                                    const value = preview.stats[stat];

                                    return (
                                        <div key={stat} className={`stat-bar ${isVisible ? 'visible' : 'hidden'}`}>
                                            <span className="stat-name">{stat}</span>
                                            <div className="stat-bar-bg">
                                                {isVisible ? (
                                                    <div
                                                        className="stat-bar-fill"
                                                        style={{ width: `${(value / 80) * 100}%` }}
                                                    />
                                                ) : (
                                                    <div className="stat-bar-mystery">???</div>
                                                )}
                                            </div>
                                            <span className={`stat-value ${isVisible ? '' : 'mystery-value'}`}>
                                                {isVisible ? value : '???'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mint-actions">
                                <button
                                    className="skip-btn"
                                    onClick={handleSkip}
                                    disabled={!canAffordSkip || txStatus !== 'idle'}
                                >
                                    {txStatus === 'skipping' ? '⏳ Skipping...' : `⏭️ Skip (${formatEther(SKIP_COST)} DGNE)`}
                                </button>

                                <button
                                    className="mint-btn"
                                    onClick={handleMint}
                                    disabled={!canAffordMint || txStatus !== 'idle'}
                                >
                                    {txStatus === 'minting' ? '⏳ Minting...' : `🎲 Mint (${formatEther(MINT_COST)} DGNE)`}
                                </button>
                            </div>

                            <p className="mint-note">
                                * Dragon stats are randomly generated. Only the element, 2 stats and 1 trait are revealed!
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default MintScreen;
