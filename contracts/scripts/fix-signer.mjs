// Update MintGateV2 signer to match backend
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const BACKEND_SIGNER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Second hardhat account
const MINT_GATE = '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9';

async function main() {
    const account = privateKeyToAccount(DEPLOYER_KEY);

    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const abi = [
        {
            name: 'setSigner',
            type: 'function',
            inputs: [{ name: '_signer', type: 'address' }],
            outputs: [],
            stateMutability: 'nonpayable'
        },
        {
            name: 'signer',
            type: 'function',
            inputs: [],
            outputs: [{ type: 'address' }],
            stateMutability: 'view'
        }
    ];

    // Check current signer
    const currentSigner = await publicClient.readContract({
        address: MINT_GATE,
        abi,
        functionName: 'signer',
    });
    console.log('Current signer:', currentSigner);

    // Update signer
    console.log('Setting signer to:', BACKEND_SIGNER);
    const hash = await walletClient.writeContract({
        address: MINT_GATE,
        abi,
        functionName: 'setSigner',
        args: [BACKEND_SIGNER],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Signer updated!');

    // Verify
    const newSigner = await publicClient.readContract({
        address: MINT_GATE,
        abi,
        functionName: 'signer',
    });
    console.log('New signer:', newSigner);
}

main().catch(console.error);
