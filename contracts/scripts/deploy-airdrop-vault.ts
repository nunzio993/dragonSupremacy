import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploy AirdropVault and configure it with existing contracts
 * 
 * Prerequisites:
 * - All core contracts must be deployed (run deploy-all-unified.ts first)
 * - deployed-addresses.json must exist with DragonToken address
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
    const addressesPath = path.join(__dirname, "../deployed-addresses.json");
    if (!fs.existsSync(addressesPath)) {
        console.error("❌ deployed-addresses.json not found! Run deploy-all-unified.ts first.");
        process.exit(1);
    }
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    console.log("\nLoaded existing addresses:");
    console.log("  DragonToken:", addresses.DragonToken);
    console.log("  MintGateV2:", addresses.MintGateV2);
    console.log("  BattleGate:", addresses.BattleGate);

    let nonce = await provider.getTransactionCount(deployer.address);
    console.log("Starting nonce:", nonce, "\n");

    // Load AirdropVault artifact
    const airdropVaultArtifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/AirdropVault.sol/AirdropVault.json"), "utf8"
    ));

    // ========== Deploy AirdropVault ==========
    console.log("========== Deploying AirdropVault ==========\n");

    // WinBoost wallet - for now use deployer, should be changed to dedicated wallet
    const winBoostWallet = deployer.address;
    console.log("WinBoost wallet:", winBoostWallet);
    console.log("⚠️  Using deployer as WinBoost wallet - change in production!\n");

    const factory = new ethers.ContractFactory(
        airdropVaultArtifact.abi,
        airdropVaultArtifact.bytecode,
        deployer
    );

    console.log("Deploying AirdropVault...");
    const airdropVault = await factory.deploy(
        addresses.DragonToken,
        winBoostWallet,
        { nonce: nonce++ }
    );
    await airdropVault.waitForDeployment();
    const airdropVaultAddress = await airdropVault.getAddress();
    console.log("  ✓ AirdropVault:", airdropVaultAddress);

    // ========== Configure AirdropVault ==========
    console.log("\n========== Configuring AirdropVault ==========\n");

    // Authorize MintGateV2 as spender
    if (addresses.MintGateV2) {
        console.log("Authorizing MintGateV2 as spender...");
        await (await (airdropVault as any).setAuthorizedSpender(addresses.MintGateV2, true, { nonce: nonce++ })).wait();
        console.log("  ✓ MintGateV2 authorized");
    }

    // Authorize BattleGateV2 as spender
    if (addresses.BattleGateV2) {
        console.log("Authorizing BattleGateV2 as spender...");
        await (await (airdropVault as any).setAuthorizedSpender(addresses.BattleGateV2, true, { nonce: nonce++ })).wait();
        console.log("  ✓ BattleGateV2 authorized");
    }

    // Authorize HPManager as spender (if exists)
    if (addresses.HPManager) {
        console.log("Authorizing HPManager as spender...");
        await (await (airdropVault as any).setAuthorizedSpender(addresses.HPManager, true, { nonce: nonce++ })).wait();
        console.log("  ✓ HPManager authorized");
    }

    // ========== Configure MintGateV2 to use AirdropVault ==========
    console.log("\n========== Configuring MintGateV2 ==========\n");

    const mintGateV2Artifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/MintGateV2.sol/MintGateV2.json"), "utf8"
    ));
    const mintGateV2 = new ethers.Contract(addresses.MintGateV2, mintGateV2Artifact.abi, deployer);

    console.log("Setting AirdropVault in MintGateV2...");
    await (await mintGateV2.setAirdropVault(airdropVaultAddress, { nonce: nonce++ })).wait();
    console.log("  ✓ MintGateV2 configured with AirdropVault");

    // ========== Configure BattleGateV2 (if deployed) ==========
    // Note: BattleGateV2 function may not exist in older deploy
    try {
        const battleGateV2Artifact = JSON.parse(fs.readFileSync(
            path.join(__dirname, "../artifacts-hh/src/BattleGateV2.sol/BattleGateV2.json"), "utf8"
        ));
        const battleGateV2 = new ethers.Contract(addresses.BattleGate, battleGateV2Artifact.abi, deployer);

        console.log("\n========== Configuring BattleGateV2 ==========\n");
        console.log("Setting AirdropVault in BattleGateV2...");
        await (await battleGateV2.setAirdropVault(airdropVaultAddress, { nonce: nonce++ })).wait();
        console.log("  ✓ BattleGateV2 configured with AirdropVault");
    } catch (e) {
        console.log("\n⚠️ Could not configure BattleGateV2 (may be using old BattleGate)");
    }

    // ========== Fund AirdropVault (for testing) ==========
    console.log("\n========== Funding AirdropVault (Test) ==========\n");

    // Mint test tokens to deposit
    const dragonTokenArtifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/DragonToken.sol/DragonToken.json"), "utf8"
    ));
    const dragonToken = new ethers.Contract(addresses.DragonToken, dragonTokenArtifact.abi, deployer);

    // Mint 100,000 DGNE for testing (normally 100M in prod)
    const fundAmount = ethers.parseEther("100000");
    console.log("Minting 100,000 DGNE to deployer for testing...");
    await (await dragonToken.mint(deployer.address, fundAmount, { nonce: nonce++ })).wait();
    console.log("  ✓ Minted 100,000 DGNE");

    // Approve and fund vault
    console.log("Approving AirdropVault to spend DGNE...");
    await (await dragonToken.approve(airdropVaultAddress, fundAmount, { nonce: nonce++ })).wait();
    console.log("  ✓ Approved");

    console.log("Funding AirdropVault with 100,000 DGNE...");
    await (await (airdropVault as any).fundPool(fundAmount, { nonce: nonce++ })).wait();
    console.log("  ✓ AirdropVault funded with 100,000 DGNE");

    // Verify pool balance
    const poolBalance = await (airdropVault as any).getPoolBalance();
    console.log("  ✓ Pool balance:", ethers.formatEther(poolBalance), "DGNE");

    // ========== Update deployed-addresses.json ==========
    addresses.AirdropVault = airdropVaultAddress;
    addresses.WinBoostWallet = winBoostWallet;
    addresses.airdropVaultDeployedAt = new Date().toISOString();

    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));

    console.log("\n========== AirdropVault Deployment Complete ==========\n");
    console.log("AirdropVault:", airdropVaultAddress);
    console.log("WinBoost Wallet:", winBoostWallet);
    console.log("\n✓ Address saved to deployed-addresses.json");
    console.log("\n⚠️  REMINDERS:");
    console.log("   - Update frontend config.ts with AirdropVault address");
    console.log("   - Change WinBoost wallet to dedicated address in production");
    console.log("   - Fund with 100M DGNE (not 100K) for mainnet");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
