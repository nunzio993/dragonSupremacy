/**
 * Deploy BattleGateV2 - Secure Escrow Battle System
 * 
 * Run: npx tsx scripts/deploy-battle-gate-v2.ts
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("🚀 Deploying BattleGateV2...\n");

    // Connect to local hardhat node
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    console.log(`📍 Deployer: ${deployer.address}`);

    // Get current nonce
    let nonce = await provider.getTransactionCount(deployer.address);
    console.log(`📊 Starting nonce: ${nonce}\n`);

    // Load existing addresses
    const addressesPath = path.join(__dirname, "../deployed-addresses.json");
    let addresses: Record<string, string> = {};
    if (fs.existsSync(addressesPath)) {
        addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
    }

    // Required addresses
    const stakeToken = addresses.DragonToken;
    const creatureContract = addresses.RMRKCreature;
    const treasury = deployer.address;
    const trustedBackend = deployer.address;

    if (!stakeToken || !creatureContract) {
        console.error("❌ Missing required contracts!");
        console.log("   DragonToken:", stakeToken);
        console.log("   RMRKCreature:", creatureContract);
        console.log("\nRun first:");
        console.log("   npx hardhat run scripts/deploy-local.ts --network localhost");
        console.log("   npx tsx scripts/deploy-economy-v2.ts");
        process.exit(1);
    }

    console.log("📦 Using contracts:");
    console.log(`   StakeToken (DGNE): ${stakeToken}`);
    console.log(`   CreatureContract: ${creatureContract}`);
    console.log(`   Treasury: ${treasury}`);
    console.log(`   TrustedBackend: ${trustedBackend}\n`);

    // Load artifact
    const loadArtifact = (name: string) => {
        const artifactPath = path.join(__dirname, `../artifacts-hh/src/${name}.sol/${name}.json`);
        if (!fs.existsSync(artifactPath)) {
            throw new Error(`Artifact not found: ${artifactPath}`);
        }
        return JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    };

    // Deploy BattleGateV2
    console.log("1️⃣ Deploying BattleGateV2...");
    const battleGateArtifact = loadArtifact("BattleGateV2");
    const BattleGateFactory = new ethers.ContractFactory(
        battleGateArtifact.abi,
        battleGateArtifact.bytecode,
        deployer
    );

    console.log(`   Deploying with nonce ${nonce}...`);
    const battleGate = await BattleGateFactory.deploy(
        stakeToken,
        trustedBackend,
        treasury,
        creatureContract,
        { nonce }
    );
    nonce++;
    await battleGate.waitForDeployment();
    const battleGateAddress = await battleGate.getAddress();
    console.log(`   ✅ BattleGateV2 deployed at: ${battleGateAddress}\n`);

    // Set BattleGateV2 as XP updater on creature contract
    console.log("⚙️ Configuring XP updater...");
    const creatureArtifact = loadArtifact("RMRKCreature");
    const creatureNFT = new ethers.Contract(creatureContract, creatureArtifact.abi, deployer);

    try {
        console.log(`   Setting BattleGateV2 as XP updater (nonce ${nonce})...`);
        const tx = await creatureNFT.setXPUpdater(battleGateAddress, true, { nonce });
        nonce++;
        await tx.wait();
        console.log("   ✅ XP updater set\n");
    } catch (e: any) {
        console.log(`   ⚠️ Could not set XP updater: ${e.message}\n`);
    }

    // Save addresses
    addresses.BattleGateV2 = battleGateAddress;
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log(`📝 Saved to deployed-addresses.json\n`);

    console.log("═══════════════════════════════════════════");
    console.log("🎉 BATTLEGATEV2 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════\n");
    console.log(`BattleGateV2: ${battleGateAddress}\n`);
    console.log("Next steps:");
    console.log("1. Update frontend config with BattleGateV2 address");
    console.log("2. Update backend to call resolveBattle with signature");
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
