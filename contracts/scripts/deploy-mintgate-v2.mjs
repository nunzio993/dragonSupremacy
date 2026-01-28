// Deploy MintGateV2 using viem
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';

// First Hardhat account private key (deployer)
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Existing contracts
const GAME_CONFIG = '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707';
const RMRK_CREATURE = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const DRAGON_TOKEN = '0x0165878A594ca255338adfa4d48449f69242Eb8F';

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

    console.log('Deployer:', account.address);

    // Read compiled contract
    const artifactPath = path.join(process.cwd(), 'artifacts-hh/src/MintGateV2.sol/MintGateV2.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    console.log('\n1. Deploying MintGateV2...');
    const deployHash = await walletClient.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [GAME_CONFIG, RMRK_CREATURE],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const mintGateAddress = receipt.contractAddress;
    console.log('   MintGateV2 deployed at:', mintGateAddress);

    // Authorize MintGateV2 as minter on RMRKCreature
    console.log('\n2. Authorizing MintGateV2 as minter on RMRKCreature...');
    const setMinterAbi = parseAbi(['function setMinter(address minter, bool authorized)']);

    const authHash = await walletClient.writeContract({
        address: RMRK_CREATURE,
        abi: setMinterAbi,
        functionName: 'setMinter',
        args: [mintGateAddress, true],
    });
    await publicClient.waitForTransactionReceipt({ hash: authHash });
    console.log('   MintGateV2 authorized as minter!');

    // Set mint treasury in GameConfig (skip if not supported)
    console.log('\n3. Setting mint treasury in GameConfig...');
    const setTreasuryAbi = parseAbi(['function setMintTreasury(address _treasury)']);

    try {
        const treasuryHash = await walletClient.writeContract({
            address: GAME_CONFIG,
            abi: setTreasuryAbi,
            functionName: 'setMintTreasury',
            args: [account.address],
        });
        await publicClient.waitForTransactionReceipt({ hash: treasuryHash });
        console.log('   Treasury set to:', account.address);
    } catch (e) {
        console.log('   (GameConfig does not have setMintTreasury - skipping)');
    }

    console.log('\n=== DEPLOYMENT COMPLETE ===');
    console.log('MintGateV2:', mintGateAddress);
    console.log('\nUpdate frontend config.ts with:');
    console.log(`MINT_GATE_V2: '${mintGateAddress}',`);

    // Save to file
    const configUpdate = {
        MINT_GATE_V2: mintGateAddress,
        timestamp: new Date().toISOString(),
    };
    fs.writeFileSync('mintgate-v2-address.json', JSON.stringify(configUpdate, null, 2));
    console.log('\nSaved to mintgate-v2-address.json');
}

main().catch(console.error);
