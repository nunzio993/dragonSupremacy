import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploy script for Dragon Token Economy
 * Deploys all contracts in correct order with proper configuration
 */
async function main() {
    // Connect to local hardhat node
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Hardhat account #0
        provider
    );

    console.log("Deploying contracts with account:", deployer.address);
    const balance = await provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

    const addresses: Record<string, any> = {};

    // Load artifacts
    function loadArtifact(name: string) {
        const artifactPath = path.join(__dirname, `../artifacts-hh/src/${name}.sol/${name}.json`);
        return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    }

    function loadMockArtifact(name: string) {
        const artifactPath = path.join(__dirname, `../artifacts-hh/src/mocks/${name}.sol/${name}.json`);
        return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    }

    // Deploy helper
    async function deploy(name: string, artifact: any, args: any[] = []) {
        console.log(`Deploying ${name}...`);
        const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
        const contract = await factory.deploy(...args);
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        addresses[name] = address;
        console.log(`  ✓ ${name}: ${address}`);
        return contract;
    }

    // ============ Load Artifacts ============
    console.log("Loading artifacts...\n");

    const gameConfigArtifact = loadArtifact("GameConfig");
    const dragonTokenArtifact = loadArtifact("DragonToken");
    const mockRMRKArtifact = loadMockArtifact("MockRMRK");
    const rmrkCreatureArtifact = loadArtifact("RMRKCreature");
    const mintGateArtifact = loadArtifact("MintGate");
    const dragonStakingArtifact = loadArtifact("DragonStaking");
    const battleGateArtifact = loadArtifact("BattleGate");

    // ============ Deploy Contracts ============
    console.log("============ Deploying Contracts ============\n");

    // 1. GameConfig
    const gameConfig = await deploy("GameConfig", gameConfigArtifact);

    // 2. DragonToken
    const dragonToken = await deploy("DragonToken", dragonTokenArtifact);

    // 3. MockRMRK
    console.log("\n⚠️  MockRMRK - replace with real RMRK on mainnet!");
    const mockRMRK = await deploy("MockRMRK", mockRMRKArtifact);

    // 4. RMRKCreature
    const rmrkCreature = await deploy("RMRKCreature", rmrkCreatureArtifact);

    // 5. MintGate
    const mintGate = await deploy("MintGate", mintGateArtifact, [
        addresses["GameConfig"],
        addresses["RMRKCreature"]
    ]);

    // 6. DragonStaking
    const dragonStaking = await deploy("DragonStaking", dragonStakingArtifact, [
        addresses["GameConfig"],
        addresses["DragonToken"],
        addresses["RMRKCreature"]
    ]);

    // 7. BattleGate
    const battleGate = await deploy("BattleGate", battleGateArtifact, [
        addresses["GameConfig"],
        addresses["DragonToken"],
        addresses["MockRMRK"]
    ]);

    // ============ Configure Contracts ============
    console.log("\n============ Configuring Contracts ============\n");

    // GameConfig settings
    console.log("Configuring GameConfig...");
    await (await (gameConfig as any).setDragonToken(addresses["DragonToken"])).wait();
    await (await (gameConfig as any).setRmrkToken(addresses["MockRMRK"])).wait();
    await (await (gameConfig as any).setStakingContract(addresses["DragonStaking"])).wait();
    await (await (gameConfig as any).setBattleGateContract(addresses["BattleGate"])).wait();
    console.log("  ✓ GameConfig configured");

    // Authorize minters
    console.log("Authorizing minters...");
    await (await (dragonToken as any).setMinter(addresses["DragonStaking"], true)).wait();
    console.log("  ✓ DragonStaking authorized to mint DGNE");

    await (await (rmrkCreature as any).setMinter(addresses["MintGate"], true)).wait();
    console.log("  ✓ MintGate authorized to mint creatures");

    // Mint test tokens
    console.log("\nMinting test tokens...");
    await (await (dragonToken as any).setMinter(deployer.address, true)).wait();
    await (await (dragonToken as any).mint(deployer.address, ethers.parseEther("10000"))).wait();
    console.log("  ✓ 10,000 DGNE minted to deployer");

    // ============ Done ============
    console.log("\n============ Deployment Complete ============\n");

    console.log("Contract Addresses:");
    for (const [name, addr] of Object.entries(addresses)) {
        console.log(`  ${name}: ${addr}`);
    }

    // Save addresses
    addresses["chainId"] = 31337;
    addresses["timestamp"] = new Date().toISOString();
    fs.writeFileSync(
        path.join(__dirname, "../deployed-addresses.json"),
        JSON.stringify(addresses, null, 2)
    );
    console.log("\n✓ Addresses saved to deployed-addresses.json");
    console.log("\n⚠️  REMEMBER: Replace MockRMRK with real RMRK on mainnet!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
