// Deploy MintGateV2 and configure GameConfig properly
import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// First Hardhat account private key (deployer)
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

    // Load existing addresses
    const addressesPath = path.join(__dirname, '../deployed-addresses.json');
    const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));

    console.log('\nExisting contract addresses:');
    console.log('  DragonToken:', addresses.DragonToken);
    console.log('  GameConfig:', addresses.GameConfig);
    console.log('  RMRKCreature:', addresses.RMRKCreature);

    // Read compiled contract
    const artifactPath = path.join(__dirname, '../artifacts-hh/src/MintGateV2.sol/MintGateV2.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    console.log('\n=== Step 1: Deploy MintGateV2 ===');
    // MintGateV2 constructor: (gameConfig, creatureContract, signer)
    const deployHash = await walletClient.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [addresses.GameConfig, addresses.RMRKCreature, account.address], // signer = deployer
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const mintGateAddress = receipt.contractAddress;
    console.log('✓ MintGateV2 deployed at:', mintGateAddress);

    // GameConfig ABI for configuration
    const gameConfigAbi = parseAbi([
        'function setDragonToken(address _addr)',
        'function setMintTreasury(address _treasury)',
        'function setCreatureContract(address _addr)',
        'function dragonToken() view returns (address)',
        'function mintTreasury() view returns (address)',
        'function mintCostDGNE() view returns (uint256)',
        'function skipCostDGNE() view returns (uint256)',
    ]);

    console.log('\n=== Step 2: Configure GameConfig ===');

    // Set Dragon Token
    console.log('Setting dragonToken...');
    const setTokenHash = await walletClient.writeContract({
        address: addresses.GameConfig,
        abi: gameConfigAbi,
        functionName: 'setDragonToken',
        args: [addresses.DragonToken],
    });
    await publicClient.waitForTransactionReceipt({ hash: setTokenHash });
    console.log('✓ DragonToken set');

    // Set Mint Treasury (deployer receives payments for testing)
    console.log('Setting mintTreasury...');
    const setTreasuryHash = await walletClient.writeContract({
        address: addresses.GameConfig,
        abi: gameConfigAbi,
        functionName: 'setMintTreasury',
        args: [account.address],
    });
    await publicClient.waitForTransactionReceipt({ hash: setTreasuryHash });
    console.log('✓ MintTreasury set to:', account.address);

    // Set Creature Contract
    console.log('Setting creatureContract...');
    const setCreatureHash = await walletClient.writeContract({
        address: addresses.GameConfig,
        abi: gameConfigAbi,
        functionName: 'setCreatureContract',
        args: [addresses.RMRKCreature],
    });
    await publicClient.waitForTransactionReceipt({ hash: setCreatureHash });
    console.log('✓ CreatureContract set');

    console.log('\n=== Step 3: Authorize MintGateV2 as minter ===');
    const rmrkCreatureAbi = parseAbi([
        'function setMinter(address minter, bool authorized)',
        'function authorizedMinters(address) view returns (bool)',
    ]);

    const authHash = await walletClient.writeContract({
        address: addresses.RMRKCreature,
        abi: rmrkCreatureAbi,
        functionName: 'setMinter',
        args: [mintGateAddress, true],
    });
    await publicClient.waitForTransactionReceipt({ hash: authHash });
    console.log('✓ MintGateV2 authorized as minter on RMRKCreature');

    console.log('\n=== Step 4: Verify Configuration ===');

    const dragonToken = await publicClient.readContract({
        address: addresses.GameConfig,
        abi: gameConfigAbi,
        functionName: 'dragonToken',
    });
    console.log('  dragonToken:', dragonToken);

    const mintTreasury = await publicClient.readContract({
        address: addresses.GameConfig,
        abi: gameConfigAbi,
        functionName: 'mintTreasury',
    });
    console.log('  mintTreasury:', mintTreasury);

    const mintCost = await publicClient.readContract({
        address: addresses.GameConfig,
        abi: gameConfigAbi,
        functionName: 'mintCostDGNE',
    });
    console.log('  mintCostDGNE:', formatEther(mintCost), 'DGNE');

    const skipCost = await publicClient.readContract({
        address: addresses.GameConfig,
        abi: gameConfigAbi,
        functionName: 'skipCostDGNE',
    });
    console.log('  skipCostDGNE:', formatEther(skipCost), 'DGNE');

    const isMinter = await publicClient.readContract({
        address: addresses.RMRKCreature,
        abi: rmrkCreatureAbi,
        functionName: 'authorizedMinters',
        args: [mintGateAddress],
    });
    console.log('  MintGateV2 is minter:', isMinter);

    // Update addresses file
    addresses.MintGateV2 = mintGateAddress;
    addresses.DeployTime = new Date().toISOString();
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log('\n✓ Updated deployed-addresses.json');

    console.log('\n=== DEPLOYMENT COMPLETE ===');
    console.log('MintGateV2:', mintGateAddress);
    console.log('\nUpdate frontend config.ts:');
    console.log(`MINT_GATE_V2: '${mintGateAddress?.toLowerCase()}',`);
}

main().catch(console.error);
