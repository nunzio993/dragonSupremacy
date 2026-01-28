/**
 * Emergency Refund Script
 * Unlocks stuck battles on BattleGateV2
 * 
 * Usage: npx ts-node scripts/emergency-refund.ts
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Hardhat account #0 private key (deployer/owner)
const OWNER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const BATTLE_GATE_V2 = '0x68B1D87F95878fE05B998F19b66F4baba5De1aed' as const;

const ABI = parseAbi([
    'function getPlayerBattle(address wallet) view returns (bytes32)',
    'function getBattle(bytes32 battleId) view returns ((address host, address guest, uint256 hostCreatureId, uint256 guestCreatureId, uint256 stakeAmount, uint256 createdAt, uint256 matchedAt, uint256 resolvedAt, uint8 state, address winner))',
    'function emergencyRefund(bytes32 battleId) external',
]);

async function main() {
    const account = privateKeyToAccount(OWNER_PRIVATE_KEY);

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    console.log('Emergency Refund Script');
    console.log('Owner:', account.address);

    // Test wallets - first 5 hardhat accounts
    const testWallets = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Account #0
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Account #1
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Account #2
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Account #3
        '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // Account #4
    ];

    for (const wallet of testWallets) {
        const battleId = await publicClient.readContract({
            address: BATTLE_GATE_V2,
            abi: ABI,
            functionName: 'getPlayerBattle',
            args: [wallet as `0x${string}`],
        });

        if (battleId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            continue;
        }

        console.log(`\nWallet ${wallet}:`);
        console.log(`  Battle ID: ${battleId}`);

        const battle = await publicClient.readContract({
            address: BATTLE_GATE_V2,
            abi: ABI,
            functionName: 'getBattle',
            args: [battleId],
        });

        const stateNames = ['NONE', 'CREATED', 'MATCHED', 'RESOLVED', 'CLAIMED', 'EXPIRED'];
        console.log(`  State: ${stateNames[battle.state]}`);
        console.log(`  Host: ${battle.host}`);
        console.log(`  Guest: ${battle.guest}`);

        if (battle.state === 1 || battle.state === 2) { // CREATED or MATCHED
            console.log('  -> Calling emergencyRefund...');
            const hash = await walletClient.writeContract({
                address: BATTLE_GATE_V2,
                abi: ABI,
                functionName: 'emergencyRefund',
                args: [battleId],
            });
            console.log(`  -> Refunded! TX: ${hash}`);
        }
    }

    console.log('\n✅ Done!');
}

main().catch(console.error);
