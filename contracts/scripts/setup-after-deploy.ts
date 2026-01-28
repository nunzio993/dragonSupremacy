/**
 * POST-DEPLOY SETUP SCRIPT
 * 
 * Eseguire SEMPRE dopo npm run node + deploy-all-unified.ts + deploy-battle-gate-v2.ts
 * 
 * Fa:
 * 1. Aggiunge account #0, #1, #2 come contributor su RMRKCreature
 * 2. Aggiunge account #0, #1, #2 come minter su RMRKCreature
 * 3. Minta DGNE e RMRK a tutti gli account
 * 4. Aggiorna automaticamente gli indirizzi in frontend/src/contracts/config.ts
 * 
 * Usage: npx ts-node scripts/setup-after-deploy.ts
 */

import { createWalletClient, createPublicClient, http, parseAbi, formatEther } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Read deployed addresses
const addressesPath = path.join(__dirname, '..', 'deployed-addresses.json');
const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));

const RMRK_CREATURE = addresses.RMRKCreature as `0x${string}`;
const DGNE_TOKEN = addresses.DragonToken as `0x${string}`;
const MOCK_RMRK = addresses.MockRMRK as `0x${string}`;
const BATTLE_GATE_V2 = addresses.BattleGateV2 as `0x${string}`;

const CREATURE_ABI = parseAbi([
    'function manageContributor(address contributor, bool grantRole) external',
    'function setMinter(address minter, bool authorized) external',
    'function isContributor(address) view returns (bool)',
]);

const TOKEN_ABI = parseAbi([
    'function mint(address to, uint256 amount) external',
    'function balanceOf(address) view returns (uint256)',
]);

const TEST_ACCOUNTS = [
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Account #0
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Account #1
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Account #2
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Account #3
    '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // Account #4
];

async function main() {
    console.log('\n🚀 POST-DEPLOY SETUP\n');
    console.log('Addresses from deployed-addresses.json:');
    console.log(`  RMRKCreature: ${RMRK_CREATURE}`);
    console.log(`  DragonToken: ${DGNE_TOKEN}`);
    console.log(`  MockRMRK: ${MOCK_RMRK}`);
    console.log(`  BattleGateV2: ${BATTLE_GATE_V2 || 'NOT DEPLOYED'}`);

    const account = privateKeyToAccount(OWNER_PRIVATE_KEY);

    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545'),
    });

    // Step 1: Add contributors and minters
    console.log('\n📝 Setting up RMRKCreature permissions...');
    for (const addr of TEST_ACCOUNTS) {
        const isContrib = await publicClient.readContract({
            address: RMRK_CREATURE,
            abi: CREATURE_ABI,
            functionName: 'isContributor',
            args: [addr as `0x${string}`],
        });

        if (!isContrib) {
            console.log(`  Adding ${addr.slice(0, 10)}... as contributor`);
            await walletClient.writeContract({
                address: RMRK_CREATURE,
                abi: CREATURE_ABI,
                functionName: 'manageContributor',
                args: [addr as `0x${string}`, true],
            });
        }

        // Also add as minter
        try {
            await walletClient.writeContract({
                address: RMRK_CREATURE,
                abi: CREATURE_ABI,
                functionName: 'setMinter',
                args: [addr as `0x${string}`, true],
            });
            console.log(`  Added ${addr.slice(0, 10)}... as minter`);
        } catch (e) {
            // setMinter might not exist on all versions
        }
    }
    console.log('  ✅ Permissions set');

    // Step 2: Mint tokens
    console.log('\n💰 Minting tokens...');
    const MINT_AMOUNT = 1000n * 10n ** 18n; // 1000 tokens

    for (const addr of TEST_ACCOUNTS) {
        const dgneBal = await publicClient.readContract({
            address: DGNE_TOKEN,
            abi: TOKEN_ABI,
            functionName: 'balanceOf',
            args: [addr as `0x${string}`],
        });

        if (dgneBal < MINT_AMOUNT / 2n) {
            await walletClient.writeContract({
                address: DGNE_TOKEN,
                abi: TOKEN_ABI,
                functionName: 'mint',
                args: [addr as `0x${string}`, MINT_AMOUNT],
            });
            await walletClient.writeContract({
                address: MOCK_RMRK,
                abi: TOKEN_ABI,
                functionName: 'mint',
                args: [addr as `0x${string}`, MINT_AMOUNT],
            });
            console.log(`  Minted 1000 DGNE + 1000 RMRK to ${addr.slice(0, 10)}...`);
        } else {
            console.log(`  ${addr.slice(0, 10)}... already has tokens`);
        }
    }
    console.log('  ✅ Tokens minted');

    // Step 3: Update frontend config
    console.log('\n📦 Updating frontend config...');
    const configPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'contracts', 'config.ts');

    if (fs.existsSync(configPath)) {
        let config = fs.readFileSync(configPath, 'utf-8');

        // Update addresses using regex
        config = config.replace(
            /RMRKCreature:\s*\{\s*address:\s*'0x[a-fA-F0-9]+'/,
            `RMRKCreature: {\n        address: '${RMRK_CREATURE}'`
        );
        config = config.replace(
            /BATTLE_GATE:\s*'0x[a-fA-F0-9]+'/,
            `BATTLE_GATE: '${addresses.BattleGate || addresses.BATTLE_GATE}'`
        );
        config = config.replace(
            /BATTLE_GATE_V2:\s*'0x[a-fA-F0-9]+'/,
            `BATTLE_GATE_V2: '${BATTLE_GATE_V2}'`
        );
        config = config.replace(
            /DRAGON_TOKEN:\s*'0x[a-fA-F0-9]+'/,
            `DRAGON_TOKEN: '${DGNE_TOKEN}'`
        );
        config = config.replace(
            /MOCK_RMRK:\s*'0x[a-fA-F0-9]+'/,
            `MOCK_RMRK: '${MOCK_RMRK}'`
        );
        config = config.replace(
            /GAME_CONFIG:\s*'0x[a-fA-F0-9]+'/,
            `GAME_CONFIG: '${addresses.GameConfig}'`
        );

        fs.writeFileSync(configPath, config);
        console.log('  ✅ Frontend config updated');
    } else {
        console.log('  ⚠️ Frontend config not found at:', configPath);
    }

    // Step 4: Update backend service
    console.log('\n📦 Updating backend service...');
    const backendPath = path.join(__dirname, '..', '..', 'backend', 'src', 'services', 'battle-gate-v2-service.ts');

    if (fs.existsSync(backendPath) && BATTLE_GATE_V2) {
        let backend = fs.readFileSync(backendPath, 'utf-8');
        backend = backend.replace(
            /BATTLE_GATE_V2_ADDRESS\s*\|\|\s*'0x[a-fA-F0-9]+'/,
            `BATTLE_GATE_V2_ADDRESS || '${BATTLE_GATE_V2}'`
        );
        fs.writeFileSync(backendPath, backend);
        console.log('  ✅ Backend battle-gate-v2-service updated');
    }

    // Step 5: Update creature-fetcher
    const creatureFetcherPath = path.join(__dirname, '..', '..', 'backend', 'src', 'services', 'creature-fetcher.ts');

    if (fs.existsSync(creatureFetcherPath)) {
        let fetcher = fs.readFileSync(creatureFetcherPath, 'utf-8');
        fetcher = fetcher.replace(
            /RMRK_CREATURE_ADDRESS\s*\|\|\s*'0x[a-fA-F0-9]+'/,
            `RMRK_CREATURE_ADDRESS || '${RMRK_CREATURE}'`
        );
        fs.writeFileSync(creatureFetcherPath, fetcher);
        console.log('  ✅ Backend creature-fetcher updated');
    }

    console.log('\n✅ POST-DEPLOY SETUP COMPLETE!\n');
    console.log('You can now test the app. Refresh the browser if needed.');
}

main().catch(console.error);
