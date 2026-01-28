import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploy Dragon Economy contracts (add to existing RMRKCreature)
 */
async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await provider.getBalance(deployer.address)), "ETH");

    // Load existing addresses
    const existingAddresses = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../deployed-addresses.json"), "utf8"
    ));
    console.log("\nExisting RMRKCreature:", existingAddresses.RMRKCreature);

    const addresses: Record<string, any> = { ...existingAddresses };

    function loadArtifact(name: string) {
        return JSON.parse(fs.readFileSync(
            path.join(__dirname, `../artifacts-hh/src/${name}.sol/${name}.json`), "utf8"
        ));
    }

    function loadMockArtifact(name: string) {
        return JSON.parse(fs.readFileSync(
            path.join(__dirname, `../artifacts-hh/src/mocks/${name}.sol/${name}.json`), "utf8"
        ));
    }

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

    // Load artifacts
    const gameConfigArtifact = loadArtifact("GameConfig");
    const dragonTokenArtifact = loadArtifact("DragonToken");
    const mockRMRKArtifact = loadMockArtifact("MockRMRK");
    const mintGateArtifact = loadArtifact("MintGate");
    const dragonStakingArtifact = loadArtifact("DragonStaking");
    const battleGateArtifact = loadArtifact("BattleGate");
    const rmrkCreatureArtifact = loadArtifact("RMRKCreature");

    console.log("\n========== Deploying Economy Contracts ==========\n");

    // 1. GameConfig
    const gameConfig = await deploy("GameConfig", gameConfigArtifact);

    // 2. DragonToken (DGNE)
    const dragonToken = await deploy("DragonToken", dragonTokenArtifact);

    // 3. MockRMRK (for testing, replace on mainnet!)
    console.log("\n⚠️  MockRMRK - REPLACE WITH REAL RMRK ON MAINNET!");
    const mockRMRK = await deploy("MockRMRK", mockRMRKArtifact);

    // 4. MintGate
    const mintGate = await deploy("MintGate", mintGateArtifact, [
        addresses.GameConfig,
        addresses.RMRKCreature
    ]);

    // 5. DragonStaking
    const dragonStaking = await deploy("DragonStaking", dragonStakingArtifact, [
        addresses.GameConfig,
        addresses.DragonToken,
        addresses.RMRKCreature
    ]);

    // 6. BattleGate
    const battleGate = await deploy("BattleGate", battleGateArtifact, [
        addresses.GameConfig,
        addresses.DragonToken,
        addresses.MockRMRK
    ]);

    console.log("\n========== Configuring Contracts ==========\n");

    // Configure GameConfig
    console.log("Configuring GameConfig...");
    await (await (gameConfig as any).setDragonToken(addresses.DragonToken)).wait();
    await (await (gameConfig as any).setRmrkToken(addresses.MockRMRK)).wait();
    await (await (gameConfig as any).setStakingContract(addresses.DragonStaking)).wait();
    await (await (gameConfig as any).setBattleGateContract(addresses.BattleGate)).wait();
    console.log("  ✓ GameConfig configured");

    // Authorize minters
    console.log("Authorizing minters...");
    await (await (dragonToken as any).setMinter(addresses.DragonStaking, true)).wait();
    console.log("  ✓ DragonStaking can mint DGNE");

    // Authorize MintGate to mint creatures
    const rmrkCreature = new ethers.Contract(
        addresses.RMRKCreature,
        rmrkCreatureArtifact.abi,
        deployer
    );
    await (await rmrkCreature.setMinter(addresses.MintGate, true)).wait();
    console.log("  ✓ MintGate can mint creatures");

    // Save updated addresses
    addresses.timestamp = new Date().toISOString();
    fs.writeFileSync(
        path.join(__dirname, "../deployed-addresses.json"),
        JSON.stringify(addresses, null, 2)
    );

    console.log("\n========== Deployment Complete ==========\n");
    console.log("Contract Addresses:");
    for (const [name, addr] of Object.entries(addresses)) {
        if (name !== "chainId" && name !== "timestamp") {
            console.log(`  ${name}: ${addr}`);
        }
    }
    console.log("\n✓ Addresses saved to deployed-addresses.json");
    console.log("\n⚠️  REMINDER: Replace MockRMRK with real RMRK on mainnet!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
