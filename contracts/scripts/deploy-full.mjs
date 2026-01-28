// Full deploy for fresh hardhat node
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

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

    // Helper to deploy contract
    async function deploy(name, args = []) {
        const artifact = JSON.parse(fs.readFileSync(
            path.join(process.cwd(), `artifacts-hh/src/${name}.sol/${name}.json`), 'utf8'
        ));
        const hash = await walletClient.deployContract({
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            args,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`  ${name}: ${receipt.contractAddress}`);
        return receipt.contractAddress;
    }

    console.log('\n=== Deploying All Contracts ===\n');

    // 1. DragonToken
    console.log('1. DragonToken');
    const dgne = await deploy('DragonToken');

    // 2. GameConfig
    console.log('2. GameConfig');
    const gameConfig = await deploy('GameConfig');

    // 3. RMRKCreature
    console.log('3. RMRKCreature');
    const creature = await deploy('RMRKCreature');

    // 5. HPManager
    console.log('5. HPManager');
    const hpManager = await deploy('HPManager', [creature, dgne]);

    // 5. MintGateV2
    console.log('5. MintGateV2');
    const mintGate = await deploy('MintGateV2', [gameConfig, creature, account.address]);

    // 7. BattleGateV2
    console.log('7. BattleGateV2');
    const battleGate = await deploy('BattleGateV2', [dgne, account.address, account.address, creature]);

    // Setup authorizations
    console.log('\n=== Setting Up Authorizations ===\n');

    const creatureAbi = JSON.parse(fs.readFileSync(
        path.join(process.cwd(), 'artifacts-hh/src/RMRKCreature.sol/RMRKCreature.json'), 'utf8'
    )).abi;

    // Authorize MintGateV2 as minter
    console.log('Authorizing MintGateV2 as minter...');
    await walletClient.writeContract({
        address: creature,
        abi: creatureAbi,
        functionName: 'setMinter',
        args: [mintGate, true],
    });

    // Authorize HPManager to modify HP
    console.log('Authorizing HPManager...');
    await walletClient.writeContract({
        address: creature,
        abi: creatureAbi,
        functionName: 'setMinter',
        args: [hpManager, true],
    });

    // Give deployer some DGNE tokens
    console.log('\n=== Minting DGNE tokens ===\n');
    const dgneAbi = JSON.parse(fs.readFileSync(
        path.join(process.cwd(), 'artifacts-hh/src/DragonToken.sol/DragonToken.json'), 'utf8'
    )).abi;

    await walletClient.writeContract({
        address: dgne,
        abi: dgneAbi,
        functionName: 'mint',
        args: [account.address, 100000n * 10n ** 18n], // 100k DGNE
    });
    console.log('Minted 100,000 DGNE to deployer');

    console.log('\n============================================');
    console.log('=== DEPLOYMENT COMPLETE ===');
    console.log('============================================\n');
    console.log('UPDATE frontend/src/contracts/config.ts:\n');
    console.log(`    RMRKCreature: { address: '${creature}' },`);
    console.log(`    BATTLE_GATE_V2: '${battleGate}',`);
    console.log(`    DRAGON_TOKEN: '${dgne}',`);
    console.log(`    GAME_CONFIG: '${gameConfig}',`);
    console.log(`    MINT_GATE_V2: '${mintGate}',`);
    console.log('\nUPDATE backend .env or code:');
    console.log(`    HP_MANAGER: ${hpManager}`);
    console.log(`    CREATURE: ${creature}`);
    console.log(`    MINT_GATE_V2: ${mintGate}`);

    // Save to file
    fs.writeFileSync('deployed-addresses.json', JSON.stringify({
        DragonToken: dgne,
        GameConfig: gameConfig,
        RMRKCreature: creature,
        HPManager: hpManager,
        MintGateV2: mintGate,
        BattleGateV2: battleGate,
        DeployTime: new Date().toISOString(),
    }, null, 2));
    console.log('\nAddresses saved to deployed-addresses.json');
}

main().catch(console.error);
