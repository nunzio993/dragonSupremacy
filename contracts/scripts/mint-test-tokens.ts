import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mint test tokens (DGNE + MockRMRK) to Hardhat accounts for testing
 */
async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const deployer = new ethers.Wallet(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        provider
    );

    const addresses = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../deployed-addresses.json"), "utf8"
    ));

    const dragonTokenAbi = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/DragonToken.sol/DragonToken.json"), "utf8"
    )).abi;

    const mockRMRKAbi = JSON.parse(fs.readFileSync(
        path.join(__dirname, "../artifacts-hh/src/mocks/MockRMRK.sol/MockRMRK.json"), "utf8"
    )).abi;

    const dragonToken = new ethers.Contract(addresses.DragonToken, dragonTokenAbi, deployer);
    const mockRMRK = new ethers.Contract(addresses.MockRMRK, mockRMRKAbi, deployer);

    // Amount to mint: 1000 tokens each
    const amount = ethers.parseEther("1000");

    // Hardhat accounts to fund
    const accounts = [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    ];

    let nonce = await provider.getTransactionCount(deployer.address);

    console.log("💰 Minting test tokens...\n");
    console.log("Amount per account: 1000 DGNE + 1000 MockRMRK\n");

    for (const account of accounts) {
        console.log(`Minting to ${account}...`);

        // Mint DGNE (deployer is already minter from deploy)
        await (await dragonToken.mint(account, amount, { nonce: nonce++ })).wait();

        // Mint MockRMRK
        await (await mockRMRK.mint(account, amount, { nonce: nonce++ })).wait();

        console.log(`  ✓ Done`);
    }

    console.log("\n✅ All accounts funded!");
    console.log("\nBalances:");
    for (const account of accounts) {
        const dgne = await dragonToken.balanceOf(account);
        const rmrk = await mockRMRK.balanceOf(account);
        console.log(`  ${account.slice(0, 10)}...: ${ethers.formatEther(dgne)} DGNE, ${ethers.formatEther(rmrk)} RMRK`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
