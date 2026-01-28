// Check both creature contracts
import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';

const OLD_CREATURE = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const NEW_CREATURE = '0xB0D4afd8879eD9F52b28595d31B441D079B2Ca07';
const USER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

async function main() {
    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function totalSupply() view returns (uint256)',
    ]);

    console.log('=== Checking OLD contract (0xDc64...) ===');
    try {
        const oldBalance = await publicClient.readContract({
            address: OLD_CREATURE,
            abi,
            functionName: 'balanceOf',
            args: [USER],
        });
        const oldSupply = await publicClient.readContract({
            address: OLD_CREATURE,
            abi,
            functionName: 'totalSupply',
        });
        console.log('Balance:', oldBalance);
        console.log('Total supply:', oldSupply);
    } catch (e) {
        console.log('Error:', e.message?.slice(0, 50));
    }

    console.log('\n=== Checking NEW contract (0xB0D4...) ===');
    try {
        const newBalance = await publicClient.readContract({
            address: NEW_CREATURE,
            abi,
            functionName: 'balanceOf',
            args: [USER],
        });
        const newSupply = await publicClient.readContract({
            address: NEW_CREATURE,
            abi,
            functionName: 'totalSupply',
        });
        console.log('Balance:', newBalance);
        console.log('Total supply:', newSupply);
    } catch (e) {
        console.log('Error:', e.message?.slice(0, 50));
    }
}

main().catch(console.error);
