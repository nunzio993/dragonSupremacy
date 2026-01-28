import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Quick script to authorize BattleGateV2 and configure it with AirdropVault
 */
async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    const addressesPath = path.join(__dirname, "../deployed-addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

    let nonce = await provider.getTransactionCount(deployer.address);
    console.log("Starting nonce:", nonce);

    // Load AirdropVault
    const airdropVaultArtifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/AirdropVault.sol/AirdropVault.json"), "utf8"
    ));
    const airdropVault = new ethers.Contract(addresses.AirdropVault, airdropVaultArtifact.abi, deployer);

    // Load BattleGateV2
    const battleGateV2Artifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/BattleGateV2.sol/BattleGateV2.json"), "utf8"
    ));
    const battleGateV2 = new ethers.Contract(addresses.BattleGateV2, battleGateV2Artifact.abi, deployer);

    console.log("\n=== Configuring BattleGateV2 with AirdropVault ===\n");

    // Authorize BattleGateV2 to spend locked balances
    console.log("Authorizing BattleGateV2 as spender in AirdropVault...");
    await (await airdropVault.setAuthorizedSpender(addresses.BattleGateV2, true, { nonce: nonce++ })).wait();
    console.log("  ✓ BattleGateV2 authorized");

    // Set AirdropVault in BattleGateV2
    console.log("Setting AirdropVault in BattleGateV2...");
    await (await battleGateV2.setAirdropVault(addresses.AirdropVault, { nonce: nonce++ })).wait();
    console.log("  ✓ BattleGateV2 configured");

    console.log("\n=== Configuration Complete ===\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
