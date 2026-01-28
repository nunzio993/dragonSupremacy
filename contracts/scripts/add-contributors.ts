/**
 * Add contributors to RMRKCreature contract
 */

import { createWalletClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const OWNER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RMRK_CREATURE = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as const;

const ABI = parseAbi([
    'function manageContributor(address contributor, bool grantRole) external',
]);

async function main() {
    const account = privateKeyToAccount(OWNER_PRIVATE_KEY);

    const client = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const accounts = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Account #0
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Account #1
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Account #2
    ];

    for (const addr of accounts) {
        console.log(`Adding ${addr} as contributor...`);
        await client.writeContract({
            address: RMRK_CREATURE,
            abi: ABI,
            functionName: 'manageContributor',
            args: [addr as `0x${string}`, true],
        });
    }

    console.log('✅ All contributors added!');
}

main().catch(console.error);
