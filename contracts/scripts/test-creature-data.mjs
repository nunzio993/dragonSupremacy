// Test frontend-like creature data fetch
import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';

const CREATURE = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

async function main() {
    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    // Test token 1
    const tokenId = 1n;

    // Get core data
    const coreAbi = parseAbi(['function coreData(uint256) view returns (bytes32 genSeed, bytes32 personality, bytes32 elementType, bytes32 temperament, uint48 bornAt, uint8 talent)']);
    try {
        const core = await publicClient.readContract({
            address: CREATURE,
            abi: coreAbi,
            functionName: 'coreData',
            args: [tokenId],
        });
        console.log('Core data:', core);
    } catch (e) {
        console.log('Core data error:', e.message?.slice(0, 100));
    }

    // Get live stats
    const liveAbi = parseAbi(['function getLiveStats(uint256) view returns (uint8 str, uint8 agi, uint8 spd, uint8 ref_, uint8 end, uint8 vit, uint8 int_, uint8 prc, uint8 rgn)']);
    try {
        const live = await publicClient.readContract({
            address: CREATURE,
            abi: liveAbi,
            functionName: 'getLiveStats',
            args: [tokenId],
        });
        console.log('Live stats:', live);
    } catch (e) {
        console.log('Live stats error:', e.message?.slice(0, 100));
    }

    // Get moves
    const movesAbi = parseAbi(['function getMoves(uint256) view returns ((uint8,uint8,uint8,uint8,uint8,uint8,uint8,uint8)[4] moves, uint8 moveCount, uint8[4] mastery)']);
    try {
        const moves = await publicClient.readContract({
            address: CREATURE,
            abi: movesAbi,
            functionName: 'getMoves',
            args: [tokenId],
        });
        console.log('Moves:', moves);
    } catch (e) {
        console.log('Moves error:', e.message?.slice(0, 100));
    }
}

main().catch(console.error);
