import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    const addressesPath = path.join(__dirname, "../deployed-addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));

    const airdropVaultArtifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/AirdropVault.sol/AirdropVault.json"), "utf8"
    ));
    const vault = new ethers.Contract(addresses.AirdropVault, airdropVaultArtifact.abi, provider);

    console.log("=== AirdropVault Status ===\n");
    console.log("Address:", addresses.AirdropVault);

    const poolBalance = await vault.getPoolBalance();
    console.log("Pool Balance:", ethers.formatEther(poolBalance), "DGNE");

    const stats = await vault.getStats();
    console.log("\nStats:");
    console.log("  - Total Distributed:", ethers.formatEther(stats[0]), "DGNE");
    console.log("  - Total Recycled:", ethers.formatEther(stats[1]), "DGNE");
    console.log("  - Sent to WinBoost:", ethers.formatEther(stats[2]), "DGNE");
    console.log("  - Total Claimers:", stats[3].toString());
    console.log("  - Pool Balance:", ethers.formatEther(stats[4]), "DGNE");

    // Check deployer's locked balance (as example user)
    const deployer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const hasClaimed = await vault.hasClaimed(deployer);
    const lockedBalance = await vault.lockedBalance(deployer);

    console.log("\nDeployer (test user):");
    console.log("  - Has Claimed:", hasClaimed);
    console.log("  - Locked Balance:", ethers.formatEther(lockedBalance), "DGNE");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
