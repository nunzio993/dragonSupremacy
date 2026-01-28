// Verify and fix MintGateV2 authorization
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const MINT_GATE = '0x07882ae1ecb7429a84f1d53048d35c4bb2056877';
const CREATURE = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

async function main() {
    const account = privateKeyToAccount(PRIVATE_KEY);

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    // Check if MintGateV2 is authorized
    const abi = parseAbi([
        'function authorizedMinters(address) view returns (bool)',
        'function setMinter(address, bool)',
    ]);

    const isAuthorized = await publicClient.readContract({
        address: CREATURE,
        abi,
        functionName: 'authorizedMinters',
        args: [MINT_GATE],
    });

    console.log('MintGateV2 authorized:', isAuthorized);

    if (!isAuthorized) {
        console.log('Authorizing...');
        const tx = await walletClient.writeContract({
            address: CREATURE,
            abi,
            functionName: 'setMinter',
            args: [MINT_GATE, true],
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('Done!');
    }
}

main().catch(console.error);
