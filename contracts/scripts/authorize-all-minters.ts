import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Authorize all Hardhat accounts as minters for development
 */
async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    // Load deployed addresses
    const addresses = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../deployed-addresses.json"), "utf8"
    ));

    // Load RMRKCreature artifact
    const artifact = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/RMRKCreature.sol/RMRKCreature.json"), "utf8"
    ));

    const rmrkCreature = new ethers.Contract(
        addresses.RMRKCreature,
        artifact.abi,
        deployer
    );

    console.log("RMRKCreature:", addresses.RMRKCreature);
    console.log("\n🔓 Authorizing all Hardhat accounts as contributors/minters...\n");

    // All 20 Hardhat test accounts
    const hardhatAccounts = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
        "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
        "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
        "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
        "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
    ];

    let nonce = await provider.getTransactionCount(deployer.address);

    for (const account of hardhatAccounts) {
        try {
            // Check if already authorized
            const isContributor = await rmrkCreature.isContributor(account);
            if (isContributor) {
                console.log(`  ✓ ${account} - already contributor`);
                continue;
            }

            // Authorize as contributor (can mint)
            console.log(`  Authorizing ${account}...`);
            const tx = await rmrkCreature.manageContributor(account, true, { nonce: nonce++ });
            await tx.wait();
            console.log(`  ✓ ${account} - now contributor`);
        } catch (e: any) {
            console.log(`  ✗ ${account} - ${e.message || e}`);
        }
    }

    // Also authorize as minter (for MintGate pattern)
    console.log("\n🔓 Authorizing accounts as minters...\n");
    nonce = await provider.getTransactionCount(deployer.address);

    for (const account of hardhatAccounts) {
        try {
            const isMinter = await rmrkCreature.authorizedMinters(account);
            if (isMinter) {
                console.log(`  ✓ ${account} - already minter`);
                continue;
            }

            console.log(`  Authorizing ${account} as minter...`);
            const tx = await rmrkCreature.setMinter(account, true, { nonce: nonce++ });
            await tx.wait();
            console.log(`  ✓ ${account} - now minter`);
        } catch (e: any) {
            console.log(`  ✗ ${account} - ${e.message || e}`);
        }
    }

    console.log("\n✅ Done! All Hardhat accounts can now mint creatures.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
