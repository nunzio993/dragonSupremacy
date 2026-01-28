/**
 * Deploy DragonStaking Contract to existing deployment
 * Run: npx hardhat run scripts/deploy-staking.cjs --network localhost
 */
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("=".repeat(50));
    console.log("🐉 DragonStaking Contract Deployment");
    console.log("=".repeat(50));

    // Load existing deployed addresses
    let addresses = {};
    if (fs.existsSync("deployed-addresses.json")) {
        addresses = JSON.parse(fs.readFileSync("deployed-addresses.json", "utf-8"));
        console.log("\n📄 Loaded existing addresses:");
        console.log(`   GameConfig: ${addresses.GameConfig}`);
        console.log(`   DragonToken: ${addresses.DragonToken}`);
        console.log(`   RMRKCreature: ${addresses.RMRKCreature}`);
    } else {
        console.error("❌ No deployed-addresses.json found!");
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

    // 2. Authorize DragonStaking as DGNE minter
    console.log("\n2️⃣ Authorizing DragonStaking as DGNE minter...");
    const dragonToken = await ethers.getContractAt("DragonToken", addresses.DragonToken);
    await (await dragonToken.setMinter(stakingAddress, true)).wait();
    console.log("   ✅ DragonStaking can now mint DGNE");

    // 3. Configure GameConfig (optional)
    console.log("\n3️⃣ Configuring GameConfig...");
    const gameConfig = await ethers.getContractAt("GameConfig", addresses.GameConfig);
    try {
        await (await gameConfig.setStakingContract(stakingAddress)).wait();
        console.log("   ✅ GameConfig updated with staking contract");
    } catch (e) {
        console.log("   ⚠️ setStakingContract skipped (may not exist)");
    }

    // 4. Save updated addresses
    addresses.DragonStaking = stakingAddress;
    addresses.DeployTime = new Date().toISOString();
    fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
    console.log("\n💾 Saved to deployed-addresses.json");

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("=".repeat(50));
    console.log(`\nDragonStaking: ${stakingAddress}`);
    console.log("\n⚠️ SECURITY:");
    console.log("   - ReentrancyGuard protection ✅");
    console.log("   - Pausable for emergencies ✅");
    console.log("   - Only NFT owner can stake ✅");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
