// Check HPManager configuration
import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';

const HP_MANAGER = '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584';

async function main() {
    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const abi = parseAbi([
        'function dgneToken() view returns (address)',
        'function creatureContract() view returns (address)',
        'function healCostPerHPPoint() view returns (uint256)',
    ]);

    console.log('=== HPManager Config ===');
    try {
        const dgne = await publicClient.readContract({
            address: HP_MANAGER,
            abi,
            functionName: 'dgneToken',
        });
        console.log('DGNE Token:', dgne);
        console.log('Expected (old):', '0x0165878A594ca255338adfa4d48449f69242Eb8F');
    } catch (e) {
        console.log('dgneToken Error:', e.message?.slice(0, 100));
    }

    try {
        const creature = await publicClient.readContract({
            address: HP_MANAGER,
            abi,
            functionName: 'creatureContract',
        });
        console.log('\nCreature Contract:', creature);
        console.log('Expected (old):', '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9');
    } catch (e) {
        console.log('creatureContract Error:', e.message?.slice(0, 100));
    }
}

main().catch(console.error);
