import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    const addresses = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../deployed-addresses.json"), "utf8"
    ));

    console.log("Setting AirdropVault in BattleGateV2...");

    const abi = ['function airdropVault() view returns (address)', 'function setAirdropVault(address)'];
    const battleGate = new ethers.Contract(addresses.BattleGateV2, abi, deployer);

    // Check current setting
    const current = await battleGate.airdropVault();
    console.log("Current airdropVault:", current);

    if (current === "0x0000000000000000000000000000000000000000") {
        console.log("Setting to:", addresses.AirdropVault);
        const tx = await battleGate.setAirdropVault(addresses.AirdropVault);
        await tx.wait();
        console.log("✓ AirdropVault set! TX:", tx.hash);
    } else {
        console.log("Already set!");
    }

    // Verify
    console.log("Verified:", await battleGate.airdropVault());
}

main()
    .then(() => process.exit(0))
    .catch(console.error);
