/**
 * Lobby Screen
 * Shows available rooms and allows creating new matches
 * Integrates BattleGate for entry fee payment
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { ConnectWallet } from '../../components/wallet/ConnectWallet';
import { CreatureSelector } from '../../components/CreatureSelector/CreatureSelector';
import { CreatureInfo } from '../../hooks/useCreatureContract';
import { useBattleGateV2, usePlayerActiveBattle, useStakeLimits } from '../../hooks/useBattleGateV2';
import { useTokenBalances } from '../../hooks/useBattleGate';
import { initSocket, getSocket, RoomInfo } from '../../services/socket';
import { formatEther, parseEther } from 'viem';
import './Lobby.css';

export function LobbyScreen() {
    const navigate = useNavigate();
    const { isConnected, address, isCorrectChain } = useWallet();

    const [rooms, setRooms] = useState<RoomInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedCreature, setSelectedCreature] = useState<string>('');
    const [selectedCreatureData, setSelectedCreatureData] = useState<CreatureInfo | null>(null);
    const [txStep, setTxStep] = useState<'idle' | 'approving' | 'creating' | 'joining' | 'done'>('idle');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Stake amount - player can choose, limited by contract min/max
    const { minStake, maxStake } = useStakeLimits();
    const [stakeAmount, setStakeAmount] = useState<bigint>(minStake);

    // Update stakeAmount when minStake changes (e.g., on initial load)
    useEffect(() => {
        if (minStake > 0n && stakeAmount < minStake) {
            setStakeAmount(minStake);
        }
    }, [minStake, stakeAmount]);

    // BattleGateV2 integration (new escrow system)
    const {
        createBattle,
        joinBattle,
        cancelBattle,
        claimWinnings,
        emergencyRefund,
    } = useBattleGateV2();

    // Check for pending battles
    const { hasPendingBattle, battleId, canCancel, canClaim, didLose, refetch: refetchBattle } = usePlayerActiveBattle();

    // Token balances (for display)
    const { dgneBalance } = useTokenBalances();

    // Initialize socket when connected
    useEffect(() => {
        if (isConnected && address && isCorrectChain) {
            const socket = initSocket(address);

            // Get room list
            socket.emit('get_rooms', (roomList: RoomInfo[]) => {
                setRooms(roomList);
                setIsLoading(false);
            });

            // Listen for room updates
            socket.on('room_created', (room: RoomInfo) => {
                setRooms(prev => [...prev, room]);
            });

            socket.on('room_cancelled', (roomId: string) => {
                setRooms(prev => prev.filter(r => r.id !== roomId));
            });

            return () => {
                socket.off('room_created');
                socket.off('room_cancelled');
            };
        }
    }, [isConnected, address, isCorrectChain]);

    // Handle full flow: approve DGNE → createBattle on-chain → create room via socket
    const handleCreateRoom = useCallback(async () => {
        if (!selectedCreature || !selectedCreatureData) return;

        try {
            setTxStep('creating');

            // Step 1: Create battle on-chain (handles approval internally)
            const { battleId, txHash } = await createBattle(
                BigInt(selectedCreature),
                stakeAmount
            );

            console.log(`[Lobby] Battle created on-chain: ${battleId} (tx: ${txHash})`);

            // Step 2: Create room via socket with on-chain battleId
            const socket = getSocket();
            if (!socket) throw new Error('Socket not connected');

            socket.emit('create_room', {
                creatureId: selectedCreature,
                onChainBattleId: battleId,
                stakeAmount: stakeAmount.toString(),
            }, (response: { success: boolean; room?: { id: string }; error?: string }) => {
                if (response.success) {
                    setShowCreateModal(false);
                    setTxStep('idle');
                    navigate(`/room/${response.room?.id}`);
                } else {
                    alert(response.error || 'Failed to create room');
                    setTxStep('idle');
                }
            });
        } catch (error: any) {
            console.error('Create room error:', error);
            alert(error.message || 'Transaction failed');
            setTxStep('idle');
        }
    }, [selectedCreature, selectedCreatureData, stakeAmount, createBattle, navigate]);

    // Handle join room with on-chain stake deposit
    const handleJoinRoom = useCallback(async (roomId: string, roomStakeAmount: bigint, onChainBattleId: string) => {
        if (!selectedCreature) return;

        try {
            setTxStep('joining');

            // Step 1: Join battle on-chain (handles approval internally)
            const { txHash } = await joinBattle(
                onChainBattleId,
                BigInt(selectedCreature),
                roomStakeAmount
            );

            console.log(`[Lobby] Joined battle on-chain: ${onChainBattleId} (tx: ${txHash})`);

            // Step 2: Join room via socket
            const socket = getSocket();
            if (!socket) throw new Error('Socket not connected');

            socket.emit('join_room', {
                roomId,
                creatureId: selectedCreature,
                onChainBattleId,
            }, (response: { success: boolean; error?: string }) => {
                if (response.success) {
                    setTxStep('idle');
                    navigate(`/room/${roomId}`);
                } else {
                    alert(response.error || 'Failed to join room');
                    setTxStep('idle');
                }
            });
        } catch (error: any) {
            console.error('Join room error:', error);
            alert(error.message || 'Transaction failed');
            setTxStep('idle');
        }
    }, [selectedCreature, joinBattle, navigate]);

    // Handle cancel pending battle
    const handleCancelBattle = useCallback(async () => {
        if (!battleId) return;

        try {
            setTxStep('idle');
            await cancelBattle(battleId);
            refetchBattle();
            alert('Battle cancelled, stake refunded!');
        } catch (error: any) {
            console.error('Cancel battle error:', error);
            alert(error.message || 'Failed to cancel battle');
        }
    }, [battleId, cancelBattle, refetchBattle]);

    // Handle emergency refund for stuck battles (admin only)
    const handleEmergencyRefund = useCallback(async () => {
        if (!battleId) return;

        try {
            setTxStep('idle');
            await emergencyRefund(battleId);
            refetchBattle();
            alert('Emergency refund successful! Stakes returned.');
        } catch (error: any) {
            console.error('Emergency refund error:', error);
            alert(error.message || 'Failed to emergency refund (must be contract owner)');
        }
    }, [battleId, emergencyRefund, refetchBattle]);

    // Handle claim winnings
    const handleClaimWinnings = useCallback(async () => {
        if (!battleId) return;

        try {
            await claimWinnings(battleId);
            refetchBattle();
            setSuccessMessage('🎉 Congratulations! Your winnings have been sent to your wallet!');
        } catch (error: any) {
            console.error('Claim winnings error:', error);
            alert(error.message || 'Failed to claim winnings');
        }
    }, [battleId, claimWinnings, refetchBattle]);

    // Format token amount for display (integers only)
    const formatToken = (amount: bigint) => {
        return Math.floor(parseFloat(formatEther(amount))).toString();
    };

    // Get button text based on transaction step
    const getButtonText = () => {
        switch (txStep) {
            case 'approving': return 'Approving DGNE...';
            case 'creating': return 'Creating Battle...';
            case 'joining': return 'Joining Battle...';
            case 'done': return 'Done!';
            default: return `Create Room (${formatToken(stakeAmount)} DGNE)`;
        }
    };

    // Check if can afford entry
    const canAffordEntry = dgneBalance >= stakeAmount;

    // Not connected state
    if (!isConnected) {
        return (
            <div className="lobby-screen">
                <div className="lobby-connect">
                    <h1>🐉 NFT Autobattler</h1>
                    <p>Connect your wallet to enter the arena</p>
                    <ConnectWallet />
                </div>
            </div>
        );
    }

    // Wrong chain state
    if (!isCorrectChain) {
        return (
            <div className="lobby-screen">
                <div className="lobby-connect">
                    <h1>⚠️ Wrong Network</h1>
                    <p>Please switch to Hardhat (localhost) or Base Sepolia</p>
                    <ConnectWallet />
                </div>
            </div>
        );
    }

    return (
        <div className="lobby-screen">
            <main className="lobby-main">
                {/* Pending Battle Warning */}
                {hasPendingBattle && (
                    <div className="warning-banner" style={{
                        background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div>
                            <strong>⚠️ You have a pending battle on-chain!</strong>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
                                {canCancel ? 'Cancel it to create a new room.' :
                                    canClaim ? 'Claim your winnings!' :
                                        didLose ? 'Better luck next time! Clear this to continue.' :
                                            'Battle in progress...'}
                            </p>
                        </div>
                        {canCancel && (
                            <button
                                onClick={handleCancelBattle}
                                style={{
                                    background: '#fff',
                                    color: '#ff6b35',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel & Refund
                            </button>
                        )}
                        {canClaim && (
                            <button
                                onClick={handleClaimWinnings}
                                style={{
                                    background: '#fff',
                                    color: '#4CAF50',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                🏆 Claim Winnings
                            </button>
                        )}
                        {didLose && (
                            <button
                                onClick={handleClaimWinnings}
                                style={{
                                    background: '#fff',
                                    color: '#6c757d',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                ✓ Acknowledge & Continue
                            </button>
                        )}
                        {/* Force cancel for stuck battles */}
                        {!canCancel && !canClaim && (
                            <button
                                onClick={handleEmergencyRefund}
                                style={{
                                    background: '#dc3545',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                ⚠️ Force Cancel
                            </button>
                        )}
                    </div>
                )}

                {/* Stake Amount Selector */}
                <div className="entry-cost-banner">
                    <div className="stake-selector">
                        <div className="stake-header">
                            <span className="label">💰 Choose Your Stake:</span>
                            <span className="stake-value">{formatToken(stakeAmount)} DGNE</span>
                        </div>
                        <div className="stake-slider-container">
                            <span className="min-stake">{formatToken(minStake)}</span>
                            <input
                                type="range"
                                className="stake-slider"
                                min={Number(minStake / parseEther('1'))}
                                max={Number(maxStake / parseEther('1'))}
                                value={Number(stakeAmount / parseEther('1'))}
                                onChange={(e) => setStakeAmount(parseEther(e.target.value))}
                                step="10"
                            />
                            <span className="max-stake">{formatToken(maxStake)}</span>
                        </div>
                        <div className="stake-presets">
                            <button onClick={() => setStakeAmount(minStake)} className={stakeAmount === minStake ? 'active' : ''}>Min</button>
                            <button onClick={() => setStakeAmount(parseEther('50'))} className={stakeAmount === parseEther('50') ? 'active' : ''}>50</button>
                            <button onClick={() => setStakeAmount(parseEther('100'))} className={stakeAmount === parseEther('100') ? 'active' : ''}>100</button>
                            <button onClick={() => setStakeAmount(parseEther('500'))} className={stakeAmount === parseEther('500') ? 'active' : ''}>500</button>
                            <button onClick={() => setStakeAmount(maxStake)} className={stakeAmount === maxStake ? 'active' : ''}>Max</button>
                        </div>
                    </div>
                    <div className="cost-item reward">
                        <span className="label">🏆 Winner Takes:</span>
                        <span className="value">{formatToken(stakeAmount * 2n * 95n / 100n)} DGNE (95%)</span>
                    </div>
                </div>

                {/* Balance Display */}
                <div className="balance-display">
                    <span className={canAffordEntry ? 'balance ok' : 'balance low'}>
                        DGNE: {formatToken(dgneBalance)}
                    </span>
                </div>

                {/* Dragon Selector Section */}
                <section className="dragon-selector-section">
                    <h2 className="section-title">⚔️ Select Your Dragon</h2>

                    <CreatureSelector
                        selectedCreatureId={selectedCreature}
                        onSelect={(creatureId, creatureData) => {
                            setSelectedCreature(creatureId);
                            setSelectedCreatureData(creatureData);
                        }}
                    />

                    <button
                        className="create-room-btn"
                        onClick={() => setShowCreateModal(true)}
                        disabled={!selectedCreature || !canAffordEntry}
                    >
                        {canAffordEntry ? '+ Create Match' : '⚠️ Insufficient Tokens'}
                    </button>
                </section>

                <section className="room-list">
                    <h2>Available Matches</h2>

                    {isLoading ? (
                        <div className="loading">Loading rooms...</div>
                    ) : rooms.length === 0 ? (
                        <div className="no-rooms">
                            <p>No matches available</p>
                            <p className="hint">Create one to start battling!</p>
                        </div>
                    ) : (
                        <div className="rooms">
                            {rooms.map(room => (
                                <div key={room.id} className="room-card">
                                    <div className="room-info">
                                        <div className="room-host">
                                            <span className="creature-name">{room.hostCreatureName}</span>
                                            <span className="creature-type">({room.hostCreatureType})</span>
                                        </div>
                                        <div className="room-stake">
                                            🏆 Stake: {formatToken(BigInt(room.stakeAmount || '0'))} DGNE
                                        </div>
                                    </div>
                                    <button
                                        className="join-btn"
                                        onClick={() => handleJoinRoom(room.id, BigInt(room.stakeAmount || '0'), room.onChainBattleId || '')}
                                        disabled={!selectedCreature || !canAffordEntry || txStep !== 'idle' || !room.onChainBattleId}
                                    >
                                        {txStep !== 'idle' ? 'Processing...' : 'Join Battle'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => txStep === 'idle' && setShowCreateModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>Create Match</h2>

                        {/* Stake Display */}
                        <div className="form-group">
                            <label>Stake Amount</label>
                            <div className="cost-display">
                                <span>{formatToken(stakeAmount)} DGNE</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Winner Takes (95%)</label>
                            <div className="reward-display">
                                🏆 {formatToken(stakeAmount * 2n * 95n / 100n)} DGNE
                            </div>
                        </div>

                        {selectedCreatureData && (
                            <div className="form-group">
                                <label>Selected Creature</label>
                                <div className="selected-creature-display">
                                    <span className="creature-name">
                                        {selectedCreatureData.personality}
                                    </span>
                                    <span className="creature-level">
                                        Lv. {selectedCreatureData.level}
                                    </span>
                                </div>
                            </div>
                        )}

                        {!canAffordEntry && (
                            <div className="warning-box">
                                ⚠️ Insufficient tokens to enter battle
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                className="cancel-btn"
                                onClick={() => setShowCreateModal(false)}
                                disabled={txStep !== 'idle'}
                            >
                                Cancel
                            </button>
                            <button
                                className="confirm-btn"
                                onClick={handleCreateRoom}
                                disabled={!selectedCreature || !canAffordEntry || txStep !== 'idle'}
                            >
                                {getButtonText()}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {successMessage && (
                <div className="modal-overlay" onClick={() => setSuccessMessage(null)}>
                    <div className="modal success-modal" onClick={e => e.stopPropagation()}>
                        <div style={{
                            fontSize: '4rem',
                            marginBottom: '1rem',
                            animation: 'bounce 0.5s ease-in-out'
                        }}>🏆</div>
                        <h2 style={{
                            color: '#4CAF50',
                            marginBottom: '1rem',
                            fontSize: '1.5rem'
                        }}>Victory!</h2>
                        <p style={{
                            fontSize: '1.1rem',
                            marginBottom: '1.5rem',
                            color: '#fff'
                        }}>{successMessage}</p>
                        <button
                            onClick={() => setSuccessMessage(null)}
                            style={{
                                background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                                color: '#fff',
                                border: 'none',
                                padding: '0.75rem 2rem',
                                borderRadius: '8px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'transform 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            Awesome! 🎉
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
