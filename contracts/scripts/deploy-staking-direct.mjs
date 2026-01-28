/**
 * Deploy DragonStaking - Direct ethers approach (no Hardhat runtime)
 * Run: node scripts/deploy-staking-direct.mjs
 */
import { createWalletClient, createPublicClient, http, getContractAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Hardhat default account 0
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

async function main() {
    console.log("=".repeat(50));
    console.log("🐉 DragonStaking Deployment (Direct Ethers)");
    console.log("=".repeat(50));

    // Load addresses
    const addressesPath = path.join(__dirname, '..', 'deployed-addresses.json');
    const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf-8'));

    console.log("\n📄 Using existing contracts:");
    console.log(`   GameConfig:   ${addresses.GameConfig}`);
    console.log(`   DragonToken:  ${addresses.DragonToken}`);
    console.log(`   RMRKCreature: ${addresses.RMRKCreature}`);

    // Setup clients
    const account = privateKeyToAccount(DEPLOYER_KEY);
    const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http('http://127.0.0.1:8545')
    });
    const publicClient = createPublicClient({
        chain: hardhat,
        transport: http('http://127.0.0.1:8545')
    });

    console.log(`\n🔑 Deployer: ${account.address}`);

    // Load artifact
    const artifactPath = path.join(__dirname, '..', 'artifacts-hh', 'src', 'DragonStaking.sol', 'DragonStaking.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));

    // Encode constructor args
    const { ethers } = await import('ethers');
    const iface = new ethers.Interface(artifact.abi);
    const constructorArgs = iface.encodeDeploy([
        addresses.GameConfig,
        addresses.DragonToken,
        addresses.RMRKCreature
    ]).slice(2); // Remove 0x prefix

    // Deploy
    console.log("\n1️⃣ Deploying DragonStaking...");
    const deployData = artifact.bytecode + constructorArgs;
    const hash = await walletClient.sendTransaction({ data: deployData });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const stakingAddress = receipt.contractAddress;
    console.log(`   ✅ DragonStaking: ${stakingAddress}`);

    // Load DragonToken ABI for setMinter
    const tokenArtifactPath = path.join(__dirname, '..', 'artifacts-hh', 'src', 'DragonToken.sol', 'DragonToken.json');
    const tokenArtifact = JSON.parse(fs.readFileSync(tokenArtifactPath, 'utf-8'));

    // Authorize as minter
    console.log("\n2️⃣ Authorizing as DGNE minter...");
    const mintHash = await walletClient.writeContract({
        address: addresses.DragonToken,
        abi: tokenArtifact.abi,
        functionName: 'setMinter',
        args: [stakingAddress, true]
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    console.log("   ✅ DragonStaking can mint DGNE");

    // Save
    addresses.DragonStaking = stakingAddress;
    addresses.DeployTime = new Date().toISOString();
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log("\n💾 Saved to deployed-addresses.json");

    console.log("\n" + "=".repeat(50));
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("=".repeat(50));
    console.log(`\nDragonStaking: ${stakingAddress}`);
}

main().catch(console.error);
