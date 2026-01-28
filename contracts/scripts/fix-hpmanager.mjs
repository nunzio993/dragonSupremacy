// Reconfigure HPManager to use the correct DGNE token
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const HP_MANAGER = '0x4C4a2f8c81640e47606d3fd77B353E87Ba015584';
const OLD_DGNE = '0x0165878A594ca255338adfa4d48449f69242Eb8F';
const OLD_CREATURE = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

async function main() {
    const account = privateKeyToAccount(DEPLOYER_KEY);

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    // Try to update dgneToken
    const abi = parseAbi([
        'function setDgneToken(address) external',
        'function setCreatureContract(address) external',
        'function dgneToken() view returns (address)',
    ]);

    console.log('Updating HPManager...');

    try {
        const tx = await walletClient.writeContract({
            address: HP_MANAGER,
            abi,
            functionName: 'setDgneToken',
            args: [OLD_DGNE],
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('DGNE token updated!');
    } catch (e) {
        console.log('setDgneToken failed:', e.message?.slice(0, 100));
    }

    try {
        const tx = await walletClient.writeContract({
            address: HP_MANAGER,
            abi,
            functionName: 'setCreatureContract',
            args: [OLD_CREATURE],
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
        console.log('Creature contract updated!');
    } catch (e) {
        console.log('setCreatureContract failed:', e.message?.slice(0, 100));
    }

    // Verify
    const dgne = await publicClient.readContract({
        address: HP_MANAGER,
        abi,
        functionName: 'dgneToken',
    });
    console.log('\nNew DGNE Token:', dgne);
}

main().catch(console.error);
