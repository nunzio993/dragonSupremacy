// Approve DGNE for MintGateV2
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// User account (same as deployer in dev)
const USER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DRAGON_TOKEN = '0x5fbdb2315678afecb367f032d93f642f64180aa3';
const MINT_GATE = '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9';

async function main() {
    const account = privateKeyToAccount(USER_KEY);
    console.log('Approving DGNE for user:', account.address);

    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const erc20Abi = [
        {
            name: 'approve',
            type: 'function',
            inputs: [
                { name: 'spender', type: 'address' },
                { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ type: 'bool' }],
            stateMutability: 'nonpayable'
        },
        {
            name: 'allowance',
            type: 'function',
            inputs: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' }
            ],
            outputs: [{ type: 'uint256' }],
            stateMutability: 'view'
        },
        {
            name: 'balanceOf',
            type: 'function',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ type: 'uint256' }],
            stateMutability: 'view'
        }
    ];

    // Check balance
    const balance = await publicClient.readContract({
        address: DRAGON_TOKEN,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
    });
    console.log('DGNE Balance:', Number(balance) / 1e18, 'DGNE');

    // Approve unlimited
    const hash = await walletClient.writeContract({
        address: DRAGON_TOKEN,
        abi: erc20Abi,
        functionName: 'approve',
        args: [MINT_GATE, 2n ** 256n - 1n],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Check allowance
    const allowance = await publicClient.readContract({
        address: DRAGON_TOKEN,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address, MINT_GATE],
    });
    console.log('✅ Approved! Allowance:', allowance > 10n ** 30n ? 'unlimited' : Number(allowance) / 1e18);
}

main().catch(console.error);
