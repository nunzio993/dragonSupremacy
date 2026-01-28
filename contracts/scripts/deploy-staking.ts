/**
 * Deploy DragonStaking Contract
 * Run: npx ts-node scripts/deploy-staking.ts
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("=".repeat(50));
    console.log("🐉 DragonStaking Contract Deployment");
    console.log("=".repeat(50));

    // Load existing deployed addresses
    const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
    let addresses: Record<string, string> = {};

    if (fs.existsSync(addressesPath)) {
        addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
        console.log("\n📄 Loaded existing addresses:");
        console.log(`   GameConfig: ${addresses.GameConfig}`);
        console.log(`   DragonToken: ${addresses.DragonToken}`);
        console.log(`   RMRKCreature: ${addresses.RMRKCreature}`);
    } else {
        console.error("❌ No deployed-addresses.json found! Deploy other contracts first.");
        process.exit(1);
    }

    // Verify required contracts exist
    if (!addresses.GameConfig || !addresses.DragonToken || !addresses.RMRKCreature) {
        console.error("❌ Missing required contract addresses!");
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    console.log(`\n🔑 Deploying with account: ${deployer.address}`);

    // 1. Deploy DragonStaking
    console.log("\n1️⃣ Deploying DragonStaking...");
    const DragonStaking = await ethers.getContractFactory("DragonStaking");
    const dragonStaking = await DragonStaking.deploy(
        addresses.GameConfig,
        addresses.DragonToken,
        addresses.RMRKCreature
    );
    await dragonStaking.waitForDeployment();
    const stakingAddress = await dragonStaking.getAddress();
    console.log(`   ✅ DragonStaking deployed at: ${stakingAddress}`);

    // 2. Authorize DragonStaking as DGNE minter (SECURITY: Only staking can mint rewards)
    console.log("\n2️⃣ Authorizing DragonStaking as DGNE minter...");
    const dragonToken = await ethers.getContractAt("DragonToken", addresses.DragonToken);
    await (await dragonToken.setMinter(stakingAddress, true)).wait();
    console.log("   ✅ DragonStaking authorized to mint DGNE");

    // 3. Update GameConfig with staking contract address
    console.log("\n3️⃣ Configuring GameConfig...");
    const gameConfig = await ethers.getContractAt("GameConfig", addresses.GameConfig);

    // Check if setStakingContract exists
    try {
        await (await gameConfig.setStakingContract(stakingAddress)).wait();
        console.log("   ✅ GameConfig updated with staking contract");
    } catch (e) {
        console.log("   ⚠️ setStakingContract not found (optional)");
    }

    // 4. Save updated addresses
    addresses.DragonStaking = stakingAddress;
    addresses.DeployTime = new Date().toISOString();
    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
    console.log("\n💾 Updated deployed-addresses.json");

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("=".repeat(50));
    console.log(`\nDragonStaking: ${stakingAddress}`);
    console.log("\n⚠️ SECURITY NOTES:");
    console.log("   - DragonStaking can mint DGNE tokens (minter role)");
    console.log("   - Contract has ReentrancyGuard protection");
    console.log("   - Contract has Pausable for emergency stops");
    console.log("   - Only NFT owner can stake their token");
    console.log("   - Talent is passed by user (trusted for now)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
