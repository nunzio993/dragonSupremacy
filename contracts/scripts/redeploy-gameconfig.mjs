// Redeploy GameConfig with all required settings
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const DRAGON_TOKEN = '0x0165878A594ca255338adfa4d48449f69242Eb8F';
const RMRK_TOKEN = '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853';
const CREATURE_CONTRACT = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';
const TREASURY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

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

    // Read GameConfig artifact
    const artifactPath = path.join(process.cwd(), 'artifacts-hh/src/GameConfig.sol/GameConfig.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    console.log('\n1. Deploying new GameConfig...');
    const deployHash = await walletClient.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const gameConfigAddress = receipt.contractAddress;
    console.log('   GameConfig deployed at:', gameConfigAddress);

    // Configure GameConfig
    console.log('\n2. Configuring GameConfig...');

    // Set dragonToken
    const tx1 = await walletClient.writeContract({
        address: gameConfigAddress,
        abi: artifact.abi,
        functionName: 'setDragonToken',
        args: [DRAGON_TOKEN],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx1 });
    console.log('   dragonToken set');

    // Set rmrkToken
    const tx2 = await walletClient.writeContract({
        address: gameConfigAddress,
        abi: artifact.abi,
        functionName: 'setRmrkToken',
        args: [RMRK_TOKEN],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx2 });
    console.log('   rmrkToken set');

    // Set creatureContract
    const tx3 = await walletClient.writeContract({
        address: gameConfigAddress,
        abi: artifact.abi,
        functionName: 'setCreatureContract',
        args: [CREATURE_CONTRACT],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx3 });
    console.log('   creatureContract set');

    // Set mintTreasury
    const tx4 = await walletClient.writeContract({
        address: gameConfigAddress,
        abi: artifact.abi,
        functionName: 'setMintTreasury',
        args: [TREASURY],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx4 });
    console.log('   mintTreasury set');

    // Set mint costs (1000 DGNE mint, 100 DGNE skip, 10 RMRK)
    const tx5 = await walletClient.writeContract({
        address: gameConfigAddress,
        abi: artifact.abi,
        functionName: 'setMintCosts',
        args: [BigInt("1000000000000000000000"), BigInt("100000000000000000000"), BigInt("10000000000000000000")],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx5 });
    console.log('   mintCosts set');

    // Now deploy MintGateV2 with new GameConfig
    console.log('\n3. Deploying new MintGateV2...');
    const mintGateArtifact = JSON.parse(fs.readFileSync(
        path.join(process.cwd(), 'artifacts-hh/src/MintGateV2.sol/MintGateV2.json'), 'utf8'
    ));

    const mintGateHash = await walletClient.deployContract({
        abi: mintGateArtifact.abi,
        bytecode: mintGateArtifact.bytecode,
        args: [gameConfigAddress, CREATURE_CONTRACT],
    });

    const mintGateReceipt = await publicClient.waitForTransactionReceipt({ hash: mintGateHash });
    const mintGateAddress = mintGateReceipt.contractAddress;
    console.log('   MintGateV2 deployed at:', mintGateAddress);

    // Authorize MintGateV2 as minter
    console.log('\n4. Authorizing MintGateV2 as minter...');
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
    console.log('GameConfig:', gameConfigAddress);
    console.log('MintGateV2:', mintGateAddress);
    console.log('\nUpdate frontend config.ts:');
    console.log(`GAME_CONFIG: '${gameConfigAddress}',`);
    console.log(`MINT_GATE_V2: '${mintGateAddress}',`);

    // Save addresses
    fs.writeFileSync('new-contracts.json', JSON.stringify({
        GAME_CONFIG: gameConfigAddress,
        MINT_GATE_V2: mintGateAddress,
        timestamp: new Date().toISOString(),
    }, null, 2));
}

main().catch(console.error);
