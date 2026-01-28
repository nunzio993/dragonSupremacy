// Deploy MintGateV2 with EIP-712 signature verification
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';

// Deployer (owner)
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Backend signer - this is the address that signs creature data
// Using second hardhat account
const SIGNER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const signerAccount = privateKeyToAccount(SIGNER_KEY);

const GAME_CONFIG = '0xe8d2a1e88c91dcd5433208d4152cc4f399a7e91d';
const CREATURE_CONTRACT = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

async function main() {
    const deployer = privateKeyToAccount(DEPLOYER_KEY);

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const walletClient = createWalletClient({
        account: deployer,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    console.log('Deployer:', deployer.address);
    console.log('Signer (backend):', signerAccount.address);

    // Read artifact
    const artifact = JSON.parse(fs.readFileSync(
        path.join(process.cwd(), 'artifacts-hh/src/MintGateV2.sol/MintGateV2.json'), 'utf8'
    ));

    console.log('\n1. Deploying MintGateV2 with signature verification...');
    const deployHash = await walletClient.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [GAME_CONFIG, CREATURE_CONTRACT, signerAccount.address],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const mintGateAddress = receipt.contractAddress;
    console.log('   MintGateV2:', mintGateAddress);

    // Authorize as minter
    console.log('\n2. Authorizing MintGateV2 as minter...');
    const creatureAbi = [{ name: 'setMinter', type: 'function', inputs: [{ name: 'minter', type: 'address' }, { name: 'authorized', type: 'bool' }], outputs: [], stateMutability: 'nonpayable' }];

    const authTx = await walletClient.writeContract({
        address: CREATURE_CONTRACT,
        abi: creatureAbi,
        functionName: 'setMinter',
        args: [mintGateAddress, true],
    });
    await publicClient.waitForTransactionReceipt({ hash: authTx });
    console.log('   Done!');

    console.log('\n=== DEPLOYMENT COMPLETE ===');
    console.log('MintGateV2:', mintGateAddress);
    console.log('Signer:', signerAccount.address);
    console.log('\nUpdate frontend config.ts:');
    console.log(`MINT_GATE_V2: '${mintGateAddress}',`);
    console.log('\nBackend signer private key already configured in mint.ts');

    // Save
    fs.writeFileSync('mintgate-v2-secure.json', JSON.stringify({
        MINT_GATE_V2: mintGateAddress,
        SIGNER: signerAccount.address,
        SIGNER_PRIVATE_KEY: SIGNER_KEY,
    }, null, 2));
}

main().catch(console.error);
