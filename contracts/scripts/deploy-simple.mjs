// Deploy script - ES Module format per Hardhat
import hre from "hardhat";
import fs from "fs";

const { ethers } = hre;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const addresses = {};

    // 1. GameConfig
    console.log("Deploying GameConfig...");
    const GameConfig = await ethers.getContractFactory("GameConfig");
    const gameConfig = await GameConfig.deploy();
    await gameConfig.waitForDeployment();
    addresses.GameConfig = await gameConfig.getAddress();
    console.log("  GameConfig:", addresses.GameConfig);

    // 2. DragonToken
    console.log("Deploying DragonToken...");
    const DragonToken = await ethers.getContractFactory("DragonToken");
    const dragonToken = await DragonToken.deploy();
    await dragonToken.waitForDeployment();
    addresses.DragonToken = await dragonToken.getAddress();
    console.log("  DragonToken:", addresses.DragonToken);

    // 3. MockRMRK
    console.log("Deploying MockRMRK...");
    const MockRMRK = await ethers.getContractFactory("MockRMRK");
    const mockRMRK = await MockRMRK.deploy();
    await mockRMRK.waitForDeployment();
    addresses.MockRMRK = await mockRMRK.getAddress();
    console.log("  MockRMRK:", addresses.MockRMRK);

    // 4. RMRKCreature
    console.log("Deploying RMRKCreature...");
    const RMRKCreature = await ethers.getContractFactory("RMRKCreature");
    const rmrkCreature = await RMRKCreature.deploy();
    await rmrkCreature.waitForDeployment();
    addresses.RMRKCreature = await rmrkCreature.getAddress();
    console.log("  RMRKCreature:", addresses.RMRKCreature);

    // 5. MintGate
    console.log("Deploying MintGate...");
    const MintGate = await ethers.getContractFactory("MintGate");
    const mintGate = await MintGate.deploy(addresses.GameConfig, addresses.RMRKCreature);
    await mintGate.waitForDeployment();
    addresses.MintGate = await mintGate.getAddress();
    console.log("  MintGate:", addresses.MintGate);

    // 6. DragonStaking
    console.log("Deploying DragonStaking...");
    const DragonStaking = await ethers.getContractFactory("DragonStaking");
    const dragonStaking = await DragonStaking.deploy(
        addresses.GameConfig,
        addresses.DragonToken,
        addresses.RMRKCreature
    );
    await dragonStaking.waitForDeployment();
    addresses.DragonStaking = await dragonStaking.getAddress();
    console.log("  DragonStaking:", addresses.DragonStaking);

    // 7. BattleGate
    console.log("Deploying BattleGate...");
    const BattleGate = await ethers.getContractFactory("BattleGate");
    const battleGate = await BattleGate.deploy(
        addresses.GameConfig,
        addresses.DragonToken,
        addresses.MockRMRK
    );
    await battleGate.waitForDeployment();
    addresses.BattleGate = await battleGate.getAddress();
    console.log("  BattleGate:", addresses.BattleGate);

    // Configure
    console.log("\nConfiguring...");
    await (await gameConfig.setDragonToken(addresses.DragonToken)).wait();
    await (await gameConfig.setRmrkToken(addresses.MockRMRK)).wait();
    await (await gameConfig.setStakingContract(addresses.DragonStaking)).wait();
    await (await gameConfig.setBattleGateContract(addresses.BattleGate)).wait();
    await (await dragonToken.setMinter(addresses.DragonStaking, true)).wait();
    await (await rmrkCreature.setMinter(addresses.MintGate, true)).wait();
    console.log("  Done!");

    // Save
    fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
    console.log("\n✓ Saved to deployed-addresses.json");
    console.log(addresses);
}

main().catch(console.error);
