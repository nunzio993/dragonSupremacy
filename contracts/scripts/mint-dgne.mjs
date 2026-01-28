// Mint DGNE tokens for testing
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DGNE = '0x0165878A594ca255338adfa4d48449f69242Eb8F';

const abi = parseAbi([
    'function mint(address to, uint256 amount)',
    'function balanceOf(address account) view returns (uint256)',
]);

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

    console.log('Account:', account.address);

    // Mint 1 million DGNE
    console.log('\nMinting 1,000,000 DGNE...');
    const tx = await walletClient.writeContract({
        address: DGNE,
        abi,
        functionName: 'mint',
        args: [account.address, parseEther('1000000')],
    });

    await publicClient.waitForTransactionReceipt({ hash: tx });

    // Check balance
    const balance = await publicClient.readContract({
        address: DGNE,
        abi,
        functionName: 'balanceOf',
        args: [account.address],
    });

    console.log('DGNE balance:', formatEther(balance));
}

main().catch(console.error);
