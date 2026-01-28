// Check DGNE tokens on both addresses
import { createPublicClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';

const OLD_DGNE = '0x0165878A594ca255338adfa4d48449f69242Eb8F';
const NEW_DGNE = '0x922D6956C99E12DFeB3224DEA977D0939758A1Fe';
const USER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

async function main() {
    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

    console.log('=== OLD DGNE (0x0165...) ===');
    try {
        const oldBalance = await publicClient.readContract({
            address: OLD_DGNE,
            abi,
            functionName: 'balanceOf',
            args: [USER],
        });
        console.log('Balance:', Number(oldBalance) / 1e18);
    } catch (e) {
        console.log('Error:', e.message?.slice(0, 50));
    }

    console.log('\n=== NEW DGNE (0x922D...) ===');
    try {
        const newBalance = await publicClient.readContract({
            address: NEW_DGNE,
            abi,
            functionName: 'balanceOf',
            args: [USER],
        });
        console.log('Balance:', Number(newBalance) / 1e18);
    } catch (e) {
        console.log('Error:', e.message?.slice(0, 50));
    }
}

main().catch(console.error);
