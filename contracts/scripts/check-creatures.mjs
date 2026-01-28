// Check creatures on-chain
import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';

const CREATURE = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const USER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

async function main() {
    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const abi = parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function totalSupply() view returns (uint256)',
        'function ownerOf(uint256) view returns (address)',
    ]);

    const balance = await publicClient.readContract({
        address: CREATURE,
        abi,
        functionName: 'balanceOf',
        args: [USER],
    });

    const supply = await publicClient.readContract({
        address: CREATURE,
        abi,
        functionName: 'totalSupply',
    });

    console.log('Balance:', balance);
    console.log('Total supply:', supply);

    // Check owners of each token
    for (let i = 1; i <= Number(supply); i++) {
        try {
            const owner = await publicClient.readContract({
                address: CREATURE,
                abi,
                functionName: 'ownerOf',
                args: [BigInt(i)],
            });
            console.log(`Token ${i} owner:`, owner);
        } catch (e) {
            console.log(`Token ${i}: error - ${e.message?.slice(0, 50)}`);
        }
    }
}

main().catch(console.error);
