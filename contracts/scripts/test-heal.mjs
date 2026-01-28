// Test instantHeal directly
import { createPublicClient, createWalletClient, http, parseAbi, parseEther } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const USER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const HP_MANAGER = '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584';
const DGNE = '0x0165878A594ca255338adfa4d48449f69242Eb8F';

async function main() {
    const account = privateKeyToAccount(USER_KEY);

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const hpAbi = parseAbi([
        'function getHP(uint256) view returns (uint256)',
        'function getHealCost(uint256) view returns (uint256 cost, uint256 hpToHeal)',
        'function instantHeal(uint256)',
        'function treasury() view returns (address)',
        'function dgneToken() view returns (address)',
    ]);

    const tokenId = 1n;

    // Check treasury and dgneToken
    console.log('=== HPManager Config ===');
    const treasury = await publicClient.readContract({
        address: HP_MANAGER,
        abi: hpAbi,
        functionName: 'treasury',
    });
    console.log('Treasury:', treasury);

    const dgneToken = await publicClient.readContract({
        address: HP_MANAGER,
        abi: hpAbi,
        functionName: 'dgneToken',
    });
    console.log('DGNE Token:', dgneToken);

    // Check HP
    console.log('\n=== Token 1 HP ===');
    const hp = await publicClient.readContract({
        address: HP_MANAGER,
        abi: hpAbi,
        functionName: 'getHP',
        args: [tokenId],
    });
    console.log('Current HP:', hp);

    if (hp >= 100n) {
        console.log('Already at full HP, nothing to heal!');
        return;
    }

    // Check heal cost
    const [cost, hpToHeal] = await publicClient.readContract({
        address: HP_MANAGER,
        abi: hpAbi,
        functionName: 'getHealCost',
        args: [tokenId],
    });
    console.log('HP to heal:', hpToHeal);
    console.log('Cost:', Number(cost) / 1e18, 'DGNE');

    // Approve DGNE
    console.log('\n=== Approving DGNE ===');
    const dgneAbi = parseAbi(['function approve(address, uint256) returns (bool)']);
    const approveTx = await walletClient.writeContract({
        address: DGNE,
        abi: dgneAbi,
        functionName: 'approve',
        args: [HP_MANAGER, parseEther('1000')],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log('Approved!');

    // Try to heal
    console.log('\n=== Healing ===');
    try {
        const healTx = await walletClient.writeContract({
            address: HP_MANAGER,
            abi: hpAbi,
            functionName: 'instantHeal',
            args: [tokenId],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: healTx });
        console.log('✅ HEALED! Gas:', receipt.gasUsed);
    } catch (e) {
        console.error('❌ HEAL FAILED:', e.message?.slice(0, 200));
    }
}

main().catch(console.error);
