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

    console.log("Authorizing BattleGateV2 as spender on AirdropVault...");

    const abi = ['function authorizedSpenders(address) view returns (bool)', 'function setAuthorizedSpender(address,bool)'];
    const vault = new ethers.Contract(addresses.AirdropVault, abi, deployer);

    // Check current setting
    const isAuth = await vault.authorizedSpenders(addresses.BattleGateV2);
    console.log("BattleGateV2 is authorized:", isAuth);

    if (!isAuth) {
        console.log("Setting...");
        const tx = await vault.setAuthorizedSpender(addresses.BattleGateV2, true);
        await tx.wait();
        console.log("✓ Done! TX:", tx.hash);
    }

    console.log("Verified:", await vault.authorizedSpenders(addresses.BattleGateV2));
}

main()
    .then(() => process.exit(0))
    .catch(console.error);
