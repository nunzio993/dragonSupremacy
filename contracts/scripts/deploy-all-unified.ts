import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploy ALL contracts in one go with explicit nonce management
 */
async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await provider.getBalance(deployer.address)), "ETH");

    // Get current nonce and manage it explicitly to avoid race conditions
    let nonce = await provider.getTransactionCount(deployer.address);
    console.log("Starting nonce:", nonce, "\n");

    const addresses: Record<string, any> = {};

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
        const currentNonce = nonce++;
        console.log(`Deploying ${name}... (nonce: ${currentNonce})`);
        const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
        const contract = await factory.deploy(...args, { nonce: currentNonce });
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        addresses[name] = address;
        console.log(`  ✓ ${name}: ${address}`);
        return contract;
    }

    // ========== Load Artifacts ==========
    const rmrkCreatureArtifact = loadArtifact("RMRKCreature");
    const gameConfigArtifact = loadArtifact("GameConfig");
    const dragonTokenArtifact = loadArtifact("DragonToken");
    const mockRMRKArtifact = loadMockArtifact("MockRMRK");
    const mintGateV2Artifact = loadArtifact("MintGateV2");
    const dragonStakingArtifact = loadArtifact("DragonStaking");
    const battleGateV2Artifact = loadArtifact("BattleGateV2");
    const hpManagerArtifact = loadArtifact("HPManager");

    console.log("========== Deploying All Contracts ==========\n");

    // 1. RMRKCreature (NFT contract)
    const rmrkCreature = await deploy("RMRKCreature", rmrkCreatureArtifact);

    // 2. GameConfig
    const gameConfig = await deploy("GameConfig", gameConfigArtifact);

    // 3. DragonToken (DGNE)
    const dragonToken = await deploy("DragonToken", dragonTokenArtifact);

    // 4. MockRMRK
    console.log("\n⚠️  MockRMRK - REPLACE WITH REAL RMRK ON MAINNET!");
    const mockRMRK = await deploy("MockRMRK", mockRMRKArtifact);

    // 5. MintGateV2 (with signature verification)
    const mintGateV2 = await deploy("MintGateV2", mintGateV2Artifact, [
        addresses.GameConfig,
        addresses.RMRKCreature,
        deployer.address  // Signer (deployer for local dev, backend address in prod)
    ]);

    // 6. DragonStaking
    const dragonStaking = await deploy("DragonStaking", dragonStakingArtifact, [
        addresses.GameConfig,
        addresses.DragonToken,
        addresses.RMRKCreature
    ]);

    // 7. BattleGateV2 (escrow-based battle system)
    const battleGate = await deploy("BattleGateV2", battleGateV2Artifact, [
        addresses.DragonToken,      // stakeToken
        deployer.address,           // trustedBackend
        deployer.address,           // treasury
        addresses.RMRKCreature      // creatureContract
    ]);

    // 8. HPManager (HP recovery system)
    const hpManager = await deploy("HPManager", hpManagerArtifact, [
        addresses.DragonToken,  // DGNE token for instant heal
        deployer.address        // Treasury (deployer for now)
    ]);

    console.log("\n========== Configuring Contracts ==========\n");

    // Configure GameConfig with explicit nonce
    console.log("Configuring GameConfig...");
    await (await (gameConfig as any).setDragonToken(addresses.DragonToken, { nonce: nonce++ })).wait();
    await (await (gameConfig as any).setRmrkToken(addresses.MockRMRK, { nonce: nonce++ })).wait();
    await (await (gameConfig as any).setStakingContract(addresses.DragonStaking, { nonce: nonce++ })).wait();
    await (await (gameConfig as any).setBattleGate(addresses.BattleGateV2, { nonce: nonce++ })).wait();
    // Set mint treasury (required for MintGateV2!)
    await (await (gameConfig as any).setMintTreasury(deployer.address, { nonce: nonce++ })).wait();
    console.log("  ✓ MintTreasury set to deployer");
    // Set lower costs for testing (10 DGNE mint, 1 DGNE skip)
    await (await (gameConfig as any).setMintCosts(
        ethers.parseEther("10"),  // mintCostDGNE
        ethers.parseEther("1"),   // skipCostDGNE  
        ethers.parseEther("0"),   // mintCostRMRK (0 for testing)
        { nonce: nonce++ }
    )).wait();
    console.log("  ✓ Mint costs set (10 DGNE mint, 1 DGNE skip)");
    console.log("  ✓ GameConfig configured");

    // Authorize minters
    console.log("Authorizing minters...");
    await (await (dragonToken as any).setMinter(addresses.DragonStaking, true, { nonce: nonce++ })).wait();
    console.log("  ✓ DragonStaking can mint DGNE");

    await (await (rmrkCreature as any).setMinter(addresses.MintGateV2, true, { nonce: nonce++ })).wait();
    console.log("  ✓ MintGateV2 can mint creatures");

    // Set deployer as contributor for testing
    await (await (rmrkCreature as any).manageContributor(deployer.address, true, { nonce: nonce++ })).wait();
    console.log("  ✓ Deployer is contributor");

    // Configure HPManager - set deployer as hpUpdater (backend)
    console.log("Configuring HPManager...");
    await (await (hpManager as any).setHPUpdater(deployer.address, true, { nonce: nonce++ })).wait();
    console.log("  ✓ Deployer is HPUpdater");

    // Mint initial DGNE to deployer for testing
    console.log("Minting initial DGNE tokens...");
    await (await (dragonToken as any).setMinter(deployer.address, true, { nonce: nonce++ })).wait();
    await (await (dragonToken as any).mint(deployer.address, ethers.parseEther("10000"), { nonce: nonce++ })).wait();
    console.log("  ✓ Minted 10,000 DGNE to deployer");

    // Save addresses
    addresses.chainId = 31337;
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
