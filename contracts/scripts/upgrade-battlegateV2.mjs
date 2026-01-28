// Deploy updated BattleGateV2
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Get existing addresses
const addresses = JSON.parse(readFileSync('./deployed-addresses.json', 'utf8'));
const DGNE = '0x0165878A594ca255338adfa4d48449f69242Eb8F'; // old DGNE with tokens
const TREASURY = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const BACKEND = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const CREATURE = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'; // old creature with creatures

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

    // Read compiled contract
    const artifactPath = join(process.cwd(), 'artifacts-hh/src/BattleGateV2.sol/BattleGateV2.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));

    console.log('Deploying updated BattleGateV2...');
    console.log('  DGNE:', DGNE);
    console.log('  Treasury:', TREASURY);
    console.log('  Backend:', BACKEND);
    console.log('  Creature:', CREATURE);

    const hash = await walletClient.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [DGNE, BACKEND, TREASURY, CREATURE],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const newAddress = receipt.contractAddress;

    console.log('✅ BattleGateV2 deployed at:', newAddress);

    // Save new address
    addresses.BattleGateV2 = newAddress;
    addresses.BattleGateV2_DeployTime = new Date().toISOString();
    writeFileSync('./deployed-addresses.json', JSON.stringify(addresses, null, 2));

    console.log('\n⚠️  UPDATE FRONTEND: CONTRACTS.BATTLE_GATE_V2 to:', newAddress);
}

main().catch(console.error);
