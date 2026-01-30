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

    // Load RMRKCreature ABI
    const artifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/RMRKCreature.sol/RMRKCreature.json"), "utf8"
    ));

    const rmrkCreature = new ethers.Contract(
        "0x4631BCAbD6dF18D94796344963cB60d44a4136b6",
        artifact.abi,
        deployer
    );

    const mintGate = "0xAA292E8611aDF267e563f334Ee42320aC96D0463";

    console.log("Authorizing MintGateV2 to mint creatures...");
    const tx = await rmrkCreature.setMinter(mintGate, true);
    console.log("TX:", tx.hash);
    await tx.wait();
    console.log("✓ MintGateV2 authorized!");

    // Verify
    const isAuthorized = await rmrkCreature.authorizedMinters(mintGate);
    console.log("Verification - MintGateV2 is authorized:", isAuthorized);
}

main()
    .then(() => process.exit(0))
    .catch(console.error);
