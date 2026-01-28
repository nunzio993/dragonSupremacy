/**
 * Deploy Economy Contracts - Sequential Version
 * 
 * Uses explicit nonce management to avoid nonce errors
 * 
 * Run: npx tsx scripts/deploy-economy-v2.ts
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("🚀 Deploying Dragon Token Economy contracts (v2)...\n");

    // Connect to local hardhat node
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    console.log(`📍 Deployer: ${deployer.address}`);
    const balance = await provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

    // Get current nonce
    let nonce = await provider.getTransactionCount(deployer.address);
    console.log(`📊 Starting nonce: ${nonce}\n`);

    // Load artifacts
    const loadArtifact = (name: string) => {
        const artifactPath = path.join(__dirname, `../artifacts-hh/src/${name}.sol/${name}.json`);
        if (!fs.existsSync(artifactPath)) {
            throw new Error(`Artifact not found: ${artifactPath}`);
        }
        return JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    };

    // Helper to deploy with explicit nonce
    async function deployContract(name: string, factory: ethers.ContractFactory, args: any[] = []) {
        console.log(`   Deploying with nonce ${nonce}...`);
        const contract = await factory.deploy(...args, { nonce });
        nonce++;
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        console.log(`   ✅ ${name} deployed at: ${address}\n`);
        return { contract, address };
    }

    // Helper to send tx with explicit nonce
    async function sendTx(contract: any, method: string, args: any[], desc: string) {
        console.log(`   ${desc} (nonce ${nonce})...`);
        const tx = await contract[method](...args, { nonce });
        nonce++;
        await tx.wait();
        console.log(`   ✅ Done`);
    }

    // Placeholder creature address (we'll use a dummy since RMRKCreature deploy is broken)
    const creatureAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    // ============ Deploy GameConfig ============
    console.log("1️⃣ Deploying GameConfig...");
    const gameConfigArtifact = loadArtifact("GameConfig");
    const GameConfigFactory = new ethers.ContractFactory(
        gameConfigArtifact.abi,
        gameConfigArtifact.bytecode,
        deployer
    );
    const { contract: gameConfig, address: gameConfigAddress } = await deployContract("GameConfig", GameConfigFactory);

    // ============ Deploy DragonToken ============
    console.log("2️⃣ Deploying DragonToken (DGNE)...");
    const dragonTokenArtifact = loadArtifact("DragonToken");
    const DragonTokenFactory = new ethers.ContractFactory(
        dragonTokenArtifact.abi,
        dragonTokenArtifact.bytecode,
        deployer
    );
    const { contract: dragonToken, address: dragonTokenAddress } = await deployContract("DragonToken", DragonTokenFactory);

    // ============ Deploy Mock RMRK Token ============
    console.log("3️⃣ Deploying Mock RMRK Token...");
    const { contract: mockRmrkToken, address: mockRmrkAddress } = await deployContract("MockRMRK", DragonTokenFactory);

    // ============ Deploy DragonStaking ============
    console.log("4️⃣ Deploying DragonStaking...");
    const dragonStakingArtifact = loadArtifact("DragonStaking");
    const DragonStakingFactory = new ethers.ContractFactory(
        dragonStakingArtifact.abi,
        dragonStakingArtifact.bytecode,
        deployer
    );
    const { contract: dragonStaking, address: dragonStakingAddress } = await deployContract(
        "DragonStaking",
        DragonStakingFactory,
        [gameConfigAddress, dragonTokenAddress, creatureAddress]
    );

    // ============ Deploy BattleGate ============
    console.log("5️⃣ Deploying BattleGate...");
    const battleGateArtifact = loadArtifact("BattleGate");
    const BattleGateFactory = new ethers.ContractFactory(
        battleGateArtifact.abi,
        battleGateArtifact.bytecode,
        deployer
    );
    const { contract: battleGate, address: battleGateAddress } = await deployContract(
        "BattleGate",
        BattleGateFactory,
        [gameConfigAddress, dragonTokenAddress, mockRmrkAddress]
    );

    // ============ Configure Contracts ============
    console.log("⚙️ Configuring contracts...\n");

    await sendTx(dragonToken, "setMinter", [dragonStakingAddress, true], "Setting DragonStaking as minter");
    await sendTx(gameConfig, "setDragonToken", [dragonTokenAddress], "Setting DragonToken in GameConfig");
    await sendTx(gameConfig, "setRmrkToken", [mockRmrkAddress], "Setting MockRMRK in GameConfig");
    await sendTx(gameConfig, "setCreatureContract", [creatureAddress], "Setting Creature in GameConfig");
    await sendTx(gameConfig, "setStakingContract", [dragonStakingAddress], "Setting Staking in GameConfig");
    await sendTx(gameConfig, "setBattleGate", [battleGateAddress], "Setting BattleGate in GameConfig");

    console.log("");
    await sendTx(dragonToken, "mint", [deployer.address, ethers.parseEther("1000")], "Minting 1000 DGNE to deployer");
    await sendTx(mockRmrkToken, "mint", [deployer.address, ethers.parseEther("100")], "Minting 100 RMRK to deployer");

    // ============ Save Addresses ============
    const addressesPath = path.join(__dirname, "../deployed-addresses.json");
    let addresses: Record<string, string> = {};
    if (fs.existsSync(addressesPath)) {
        addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
    }

    const newAddresses = {
        ...addresses,
        GameConfig: gameConfigAddress,
        DragonToken: dragonTokenAddress,
        MockRMRK: mockRmrkAddress,
        DragonStaking: dragonStakingAddress,
        BattleGate: battleGateAddress
    };

    fs.writeFileSync(addressesPath, JSON.stringify(newAddresses, null, 2));
    console.log(`\n📝 Saved addresses to deployed-addresses.json`);

    // ============ Summary ============
    console.log("\n═══════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════\n");
    console.log("Contract Addresses:");
    console.log(`  GameConfig:     ${gameConfigAddress}`);
    console.log(`  DragonToken:    ${dragonTokenAddress}`);
    console.log(`  MockRMRK:       ${mockRmrkAddress}`);
    console.log(`  DragonStaking:  ${dragonStakingAddress}`);
    console.log(`  BattleGate:     ${battleGateAddress}`);
    console.log("\n═══════════════════════════════════════════\n");
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
